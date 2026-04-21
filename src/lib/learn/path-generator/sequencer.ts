import type { RetrievedContent } from "@/lib/intelligence/retriever";
import type {
  Intent,
  PathPlan,
  PathItem,
  Chapter,
  ConceptCardRef,
  PathItemType,
} from "./types";

const CHAPTER_ORDER = [
  "Foundations",
  "Mechanisms",
  "Australian Landscape",
  "Current State",
  "Deep Dive",
  "Assessment",
];

const CONTENT_TYPE_CHAPTER: Record<string, string> = {
  concept_card: "Foundations",
  microsector_brief: "Mechanisms",
  microsector_brief_block: "Mechanisms",
  briefing: "Current State",
  podcast: "Current State",
  deep_dive: "Deep Dive",
  quiz: "Assessment",
};

const AU_DOMAIN_HINTS = new Set([
  "energy-generation",
  "energy-grid",
  "energy-storage",
  "policy",
  "finance",
]);

const AU_JURISDICTION_HINTS = ["AU", "Australia", "AEMO", "ARENA"];

const BUDGET_CAPS: Record<string, number> = {
  "15m": 5,
  "30m": 10,
  "1h": 20,
  "2h": 35,
  half_day: 60,
  full_day: 100,
};

function assignChapter(c: RetrievedContent): string {
  if (c.content_type === "article") {
    const auJ = c.jurisdictions?.some((j) =>
      AU_JURISDICTION_HINTS.some((h) =>
        j.toLowerCase().includes(h.toLowerCase()),
      ),
    );
    const auD = c.primary_domain && AU_DOMAIN_HINTS.has(c.primary_domain);
    if (auJ || auD) return "Australian Landscape";
    return "Current State";
  }
  return CONTENT_TYPE_CHAPTER[c.content_type] ?? "Current State";
}

function candidateToItem(
  c: RetrievedContent,
  chapter: string,
  position: number,
): PathItem {
  const needsVersion =
    c.content_type === "concept_card" ||
    c.content_type === "microsector_brief_block";
  const item: PathItem = {
    item_type: c.content_type as PathItemType,
    item_id: c.source_id,
    chapter,
    position,
    completion_required: chapter !== "Deep Dive",
  };
  // Version pinning: resolved by persister from DB current_version before save.
  if (needsVersion) item.item_version = 1;
  return item;
}

/**
 * Sequence candidates + prereqs into a PathPlan.
 * Chapter order: Foundations → Mechanisms → Australian Landscape → Current State → Deep Dive → Assessment.
 * Foundations: prereq-first by hop_distance, then significance desc.
 * Other chapters: significance desc. Time-budget cap. Quiz placeholder for non-intro.
 */
export function sequence(
  candidates: RetrievedContent[],
  prereqs: ConceptCardRef[],
  intent: Intent,
): PathPlan {
  const buckets = new Map<string, RetrievedContent[]>();
  CHAPTER_ORDER.forEach((c) => buckets.set(c, []));
  for (const c of candidates) buckets.get(assignChapter(c))?.push(c);

  const prereqOrder = new Map<string, number>();
  prereqs.forEach((p, i) => prereqOrder.set(p.id, i));

  const foundationsBucket = buckets.get("Foundations") ?? [];
  foundationsBucket.sort((a, b) => {
    const ap = prereqOrder.get(a.source_id) ?? Infinity;
    const bp = prereqOrder.get(b.source_id) ?? Infinity;
    if (ap !== bp) return ap - bp;
    return (b.significance_composite ?? 0) - (a.significance_composite ?? 0);
  });

  const candidateIds = new Set(candidates.map((c) => c.source_id));
  const gapPrereqs = prereqs.filter((p) => !candidateIds.has(p.id));
  const syntheticFoundations: PathItem[] = gapPrereqs.map((p, i) => ({
    item_type: "concept_card" as PathItemType,
    item_id: p.id,
    item_version: p.version,
    chapter: "Foundations",
    position: i,
    completion_required: true,
  }));

  for (const [chap, bucket] of buckets) {
    if (chap === "Foundations") continue;
    bucket.sort(
      (a, b) => (b.significance_composite ?? 0) - (a.significance_composite ?? 0),
    );
  }

  const cap = BUDGET_CAPS[intent.time_budget] ?? 20;
  const items: PathItem[] = [...syntheticFoundations];

  for (const chapter of CHAPTER_ORDER) {
    if (chapter === "Assessment") continue;
    const bucket = buckets.get(chapter) ?? [];
    for (const c of bucket) {
      if (items.length >= cap) break;
      items.push(candidateToItem(c, chapter, items.length));
    }
    if (items.length >= cap) break;
  }

  if (intent.learning_level !== "intro") {
    items.push({
      item_type: "quiz",
      item_id: "pending",
      chapter: "Assessment",
      position: items.length,
      completion_required: false,
      note: "Quiz placeholder — will be replaced in Phase 3 quiz generation.",
    });
  }

  items.forEach((item, idx) => (item.position = idx));

  const used = new Set(items.map((i) => i.chapter));
  const chapters: Chapter[] = CHAPTER_ORDER.filter((c) => used.has(c)).map(
    (label, idx) => ({ label, position: idx + 1 }),
  );

  return { items, chapters };
}
