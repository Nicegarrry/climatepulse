import fs from "fs";
import path from "path";
import type { CalibrationExample } from "@/lib/types";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const promptCache = new Map<string, { content: string; loadedAt: number }>();
let calibrationCache: { examples: CalibrationExample[]; loadedAt: number } | null = null;

/**
 * Load a prompt or definition file from the prompts/ directory.
 * Caches in memory with 5-min TTL.
 */
export function loadPrompt(relativePath: string): string {
  const cached = promptCache.get(relativePath);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.content;
  }
  const fullPath = path.join(process.cwd(), "prompts", relativePath);
  const content = fs.readFileSync(fullPath, "utf-8");
  promptCache.set(relativePath, { content, loadedAt: Date.now() });
  return content;
}

/**
 * Replace {{PLACEHOLDER}} tokens in a template string.
 */
export function assemblePrompt(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * Extract microsector definitions for specific domains from the full definitions file.
 * The file is organized with domain headers like: # ENERGY_GENERATION (1-10)
 * Returns only the sections matching the given domain slugs.
 */
export function extractMicrosectorDefinitions(
  domainSlugs: string[]
): string {
  const fullContent = loadPrompt("definitions/micro-sectors.md");
  const slugSet = new Set(
    domainSlugs.map((s) => s.toUpperCase().replace(/-/g, "_"))
  );

  const sections = fullContent.split(/^# /m).filter(Boolean);
  const matched: string[] = [];

  for (const section of sections) {
    const headerLine = section.split("\n")[0].trim();
    // Header format: "ENERGY_GENERATION (1-10)" or "CROSS-CUTTING TAGS (104-108)"
    const domainKey = headerLine.split(/\s*\(/)[0].trim();
    if (slugSet.has(domainKey)) {
      matched.push("# " + section.trim());
    }
  }

  // If no match (shouldn't happen), return all
  if (matched.length === 0) return fullContent;
  return matched.join("\n\n");
}

/**
 * Load and parse calibration examples from the scoring file.
 * Each example is tagged with a domain for selection.
 */
export function loadCalibrationExamples(): CalibrationExample[] {
  if (
    calibrationCache &&
    Date.now() - calibrationCache.loadedAt < CACHE_TTL_MS
  ) {
    return calibrationCache.examples;
  }

  const content = loadPrompt("scoring/calibration-examples.md");
  const examples: CalibrationExample[] = [];

  // Parse examples separated by "---" or "### Example N"
  const blocks = content.split(/^### /m).filter(Boolean);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    // Extract domain tag: [domain: energy-generation]
    const domainMatch = block.match(/\[domain:\s*([^\]]+)\]/i);
    const domain = domainMatch ? domainMatch[1].trim() : "general";

    // Extract title from **Headline**: line
    const titleMatch = block.match(/\*\*Headline\*\*:\s*"?([^"\n]+)"?/);
    const title = titleMatch ? titleMatch[1].trim() : lines[0].trim();

    // Extract composite score from **Composite**: line
    const compositeMatch = block.match(
      /\*\*Composite\*\*:\s*[\d.]+\/\d+\s*[×x*]\s*\d+\s*=\s*([\d.]+)/
    );
    const compositeAlt = block.match(/Score:\s*([\d.]+)/);
    const composite = compositeMatch
      ? parseFloat(compositeMatch[1])
      : compositeAlt
        ? parseFloat(compositeAlt[1])
        : 50;

    // Build condensed format for prompt injection
    const factorMatch = block.match(
      /breadth\s+(\d+)[\s\S]*?novelty\s+(\d+)[\s\S]*?decision\s+(\d+)[\s\S]*?magnitude\s+(\d+)[\s\S]*?authority\s+(\d+)[\s\S]*?urgency\s+(\d+)/i
    );

    let condensed: string;
    if (factorMatch) {
      condensed = `A story about "${title}" scored ${Math.round(composite)}: breadth ${factorMatch[1]}, novelty ${factorMatch[2]}, decision ${factorMatch[3]}, magnitude ${factorMatch[4]}, authority ${factorMatch[5]}, urgency ${factorMatch[6]}.`;
    } else {
      condensed = `A story about "${title}" scored ${Math.round(composite)}.`;
    }

    examples.push({ domain, title, composite, condensed });
  }

  calibrationCache = { examples, loadedAt: Date.now() };
  return examples;
}

/**
 * Select 2-3 calibration examples matching the given domain.
 * Falls back to highest-scored examples from any domain if fewer than 2 match.
 */
export function selectCalibrationExamples(
  primaryDomain: string,
  count: number = 3
): string {
  const all = loadCalibrationExamples();

  // Domain match (normalize slug: energy-generation -> energy_generation for matching)
  const normalizedDomain = primaryDomain.replace(/-/g, "_");
  const domainMatches = all.filter(
    (e) => e.domain.replace(/-/g, "_") === normalizedDomain
  );

  let selected: CalibrationExample[];
  if (domainMatches.length >= 2) {
    selected = domainMatches.slice(0, count);
  } else {
    // Supplement with highest-scored from any domain
    const others = all
      .filter((e) => e.domain.replace(/-/g, "_") !== normalizedDomain)
      .sort((a, b) => b.composite - a.composite);
    selected = [...domainMatches, ...others].slice(0, count);
  }

  const lines = selected.map((e) => e.condensed);
  lines.push("");
  lines.push(
    "An average story should score approximately 50. Scores above 75 should be rare — reserved for developments that change the landscape. Scores below 30 are routine updates or filler."
  );
  return lines.join("\n\n");
}
