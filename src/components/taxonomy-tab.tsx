"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useDevLogger } from "@/lib/dev-logger";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  ChevronDown,
  Network,
  Users,
  BarChart3,
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  Search,
  ArrowRight,
  Play,
  Loader2,
  Check,
  X,
  Tag,
  Building2,
  Landmark,
  User,
  Cpu,
  FileText,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────────────────── */

interface TaxonomyMicrosector {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  keywords: string[];
  sort_order: number;
  article_count: number;
}

interface TaxonomySector {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  article_count: number;
  microsectors: TaxonomyMicrosector[];
}

interface TaxonomyDomain {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  article_count: number;
  sectors: TaxonomySector[];
}

interface SelectedNode {
  type: "domain" | "sector" | "microsector";
  id: number;
}

interface Entity {
  id: number;
  canonical_name: string;
  entity_type: string;
  status: string;
  aliases: string[];
  mentions: number;
  metadata: Record<string, unknown> | null;
  linked_articles: number;
  first_seen: string;
}

interface EntityPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

interface EnrichmentStats {
  total_enriched: number;
  unenriched_count: number;
  entity_count: number;
  estimated_cost_usd: number;
  signal_distribution: { signal: string; count: number }[];
  sentiment_distribution: { sentiment: string; count: number }[];
  domain_distribution: { domain: string; count: number }[];
}

interface Channel {
  id: number;
  source_domain_id: number;
  source_domain_name: string;
  target_domain_id: number;
  target_domain_name: string;
  label: string;
  description: string | null;
  mechanism: string | null;
  strength: "weak" | "moderate" | "strong";
  is_active: boolean;
}

interface EnrichmentProgress {
  batchesDone: number;
  totalBatches: number;
  articlesProcessed: number;
  totalArticles: number;
  errors: number;
  totalCost: number;
}

/* ──────────────────────────────────────────────────────────────────────────
   Color maps
   ────────────────────────────────────────────────────────────────────────── */

const ENTITY_TYPE_COLORS: Record<string, string> = {
  company: "bg-status-info/15 text-status-info border-status-info/30",
  project: "bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30",
  regulation: "bg-accent-amber/15 text-accent-amber border-accent-amber/30",
  person: "bg-muted text-muted-foreground border-border",
  technology: "bg-chart-3/15 text-chart-3 border-chart-3/30",
};

const ENTITY_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  company: Building2,
  project: FileText,
  regulation: Landmark,
  person: User,
  technology: Cpu,
};

const STATUS_COLORS: Record<string, string> = {
  candidate: "bg-accent-amber/15 text-accent-amber border-accent-amber/30",
  promoted: "bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30",
  archived: "bg-muted text-muted-foreground border-border",
  dormant: "bg-chart-1/15 text-chart-1 border-chart-1/30",
};

const STRENGTH_COLORS: Record<string, string> = {
  weak: "bg-muted text-muted-foreground border-border",
  moderate: "bg-accent-amber/15 text-accent-amber border-accent-amber/30",
  strong: "bg-status-error/15 text-status-error border-status-error/30",
};

const SIGNAL_COLORS: Record<string, string> = {
  policy_change: "bg-accent-amber",
  investment: "bg-accent-emerald",
  technology: "bg-chart-1",
  regulation: "bg-status-info",
  market_shift: "bg-chart-3",
  infrastructure: "bg-chart-2",
  research: "bg-chart-4",
  default: "bg-muted-foreground",
};

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────────────────── */

export function TaxonomyTab() {
  const { log } = useDevLogger();
  const [subTab, setSubTab] = useState("tree");

  /* ── Enrichment controls state ─────────────────────────────────────── */
  const [enrichStats, setEnrichStats] = useState<EnrichmentStats | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<EnrichmentProgress | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const cancelEnrichRef = useRef(false);

  /* ── Tree state ────────────────────────────────────────────────────── */
  const [tree, setTree] = useState<TaxonomyDomain[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Set<number>>(new Set());
  const [expandedSectors, setExpandedSectors] = useState<Set<number>>(new Set());
  const [editForm, setEditForm] = useState<Record<string, string | number | string[]>>({});
  const [saving, setSaving] = useState(false);
  const [addingType, setAddingType] = useState<"domain" | "sector" | "microsector" | null>(null);
  const [addForm, setAddForm] = useState({ slug: "", name: "", description: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  /* ── Entities state ────────────────────────────────────────────────── */
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityPagination, setEntityPagination] = useState<EntityPagination | null>(null);
  const [entityPage, setEntityPage] = useState(1);
  const [entityTypeFilter, setEntityTypeFilter] = useState("__all__");
  const [entityStatusFilter, setEntityStatusFilter] = useState("__all__");
  const [entitySearch, setEntitySearch] = useState("");
  const [entityLoading, setEntityLoading] = useState(false);
  const [expandedEntities, setExpandedEntities] = useState<Set<number>>(new Set());
  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [addEntityForm, setAddEntityForm] = useState({
    canonical_name: "",
    entity_type: "company",
    aliases: "",
  });

  /* ── Channels state ────────────────────────────────────────────────── */
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [expandedChannels, setExpandedChannels] = useState<Set<number>>(new Set());
  const [addChannelForm, setAddChannelForm] = useState({
    source_domain_id: "",
    target_domain_id: "",
    label: "",
    description: "",
    mechanism: "",
    strength: "moderate" as "weak" | "moderate" | "strong",
  });

  /* ── Data fetching ─────────────────────────────────────────────────── */

  const fetchEnrichStats = useCallback(async () => {
    try {
      const res = await fetch("/api/enrichment/stats");
      if (res.ok) {
        const data = await res.json();
        setEnrichStats(data);
      }
    } catch {
      log("warn", "Failed to fetch enrichment stats");
    }
  }, [log]);

  const fetchTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      const res = await fetch("/api/taxonomy/tree");
      if (res.ok) {
        const json = await res.json();
        const domains: TaxonomyDomain[] = json.domains ?? json;
        setTree(domains);
        log("info", `Loaded taxonomy tree: ${domains.length} domains`);
      }
    } catch {
      log("error", "Failed to fetch taxonomy tree");
    } finally {
      setTreeLoading(false);
    }
  }, [log]);

  const fetchEntities = useCallback(
    async (page = 1) => {
      setEntityLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "25" });
        if (entityTypeFilter !== "__all__") params.set("type", entityTypeFilter);
        if (entityStatusFilter !== "__all__") params.set("status", entityStatusFilter);
        if (entitySearch.trim()) params.set("search", entitySearch.trim());
        const res = await fetch(`/api/entities?${params}`);
        if (res.ok) {
          const data = await res.json();
          setEntities(data.entities ?? data);
          setEntityPagination(data.pagination ?? null);
          setEntityPage(page);
        }
      } catch {
        log("error", "Failed to fetch entities");
      } finally {
        setEntityLoading(false);
      }
    },
    [entityTypeFilter, entityStatusFilter, entitySearch, log]
  );

  const fetchChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const res = await fetch("/api/channels");
      if (res.ok) {
        const data: Channel[] = await res.json();
        setChannels(data);
        log("info", `Loaded ${data.length} channels`);
      }
    } catch {
      log("error", "Failed to fetch channels");
    } finally {
      setChannelsLoading(false);
    }
  }, [log]);

  /* ── Initial load per sub-tab ──────────────────────────────────────── */

  useEffect(() => {
    fetchEnrichStats();
  }, [fetchEnrichStats]);

  useEffect(() => {
    if (subTab === "tree") fetchTree();
    if (subTab === "entities") fetchEntities(1);
    if (subTab === "signals") fetchEnrichStats();
    if (subTab === "channels") {
      fetchChannels();
      if (tree.length === 0) fetchTree();
    }
  }, [subTab, fetchTree, fetchEntities, fetchEnrichStats, fetchChannels, tree.length]);

  /* ── Enrichment run ────────────────────────────────────────────────── */

  async function runEnrichment() {
    setIsEnriching(true);
    setEnrichError(null);
    setEnrichProgress(null);
    cancelEnrichRef.current = false;

    const prog: EnrichmentProgress = {
      batchesDone: 0,
      totalBatches: 0,
      articlesProcessed: 0,
      totalArticles: 0,
      errors: 0,
      totalCost: 0,
    };

    try {
      const res = await fetch("/api/enrichment/run", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setEnrichError(body.error || "Enrichment failed");
        setIsEnriching(false);
        return;
      }
      const result = await res.json();
      prog.batchesDone = result.batches_done ?? 1;
      prog.totalBatches = result.total_batches ?? 1;
      prog.articlesProcessed = result.articles_processed ?? 0;
      prog.totalArticles = result.total_articles ?? 0;
      prog.errors = result.errors ?? 0;
      prog.totalCost = result.estimated_cost_usd ?? 0;
      setEnrichProgress({ ...prog });
      log("info", `Enrichment complete: ${prog.articlesProcessed} articles, $${prog.totalCost.toFixed(4)}`);
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsEnriching(false);
      await fetchEnrichStats();
    }
  }

  /* ── Tree interactions ─────────────────────────────────────────────── */

  function toggleDomain(id: number) {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSector(id: number) {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectTreeNode(node: SelectedNode) {
    setSelectedNode(node);
    setAddingType(null);
    setDeleteConfirm(false);

    if (node.type === "domain") {
      const d = tree.find((x) => x.id === node.id);
      if (d) setEditForm({ name: d.name, slug: d.slug, description: d.description ?? "", sort_order: d.sort_order });
    } else if (node.type === "sector") {
      for (const d of tree) {
        const s = d.sectors.find((x) => x.id === node.id);
        if (s) {
          setEditForm({ name: s.name, slug: s.slug, description: s.description ?? "", sort_order: s.sort_order, parent_domain: d.name });
          break;
        }
      }
    } else {
      for (const d of tree) {
        for (const s of d.sectors) {
          const m = s.microsectors.find((x) => x.id === node.id);
          if (m) {
            setEditForm({
              name: m.name,
              slug: m.slug,
              description: m.description ?? "",
              keywords: m.keywords,
              sort_order: m.sort_order,
              parent_sector: s.name,
              parent_domain: d.name,
              article_count: m.article_count,
            });
            break;
          }
        }
      }
    }
  }

  async function saveNode() {
    if (!selectedNode) return;
    setSaving(true);
    try {
      const endpoint =
        selectedNode.type === "domain"
          ? `/api/taxonomy/domains/${selectedNode.id}`
          : selectedNode.type === "sector"
            ? `/api/taxonomy/sectors/${selectedNode.id}`
            : `/api/taxonomy/microsectors/${selectedNode.id}`;

      const body: Record<string, unknown> = {
        name: editForm.name,
        description: editForm.description,
        sort_order: Number(editForm.sort_order),
      };
      if (selectedNode.type === "microsector" && Array.isArray(editForm.keywords)) {
        body.keywords = editForm.keywords;
      }

      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        log("info", `Saved ${selectedNode.type} ${selectedNode.id}`);
        await fetchTree();
      } else {
        log("error", `Failed to save ${selectedNode.type}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function addNode() {
    if (!addingType) return;
    const endpoint =
      addingType === "domain"
        ? "/api/taxonomy/domains"
        : addingType === "sector"
          ? "/api/taxonomy/sectors"
          : "/api/taxonomy/microsectors";

    const body: Record<string, unknown> = { ...addForm };
    if (addingType === "sector" && selectedNode?.type === "domain") {
      body.domain_id = selectedNode.id;
    }
    if (addingType === "microsector" && selectedNode?.type === "sector") {
      body.sector_id = selectedNode.id;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        log("info", `Created ${addingType}: ${addForm.name}`);
        setAddForm({ slug: "", name: "", description: "" });
        setAddingType(null);
        await fetchTree();
      } else {
        log("error", `Failed to create ${addingType}`);
      }
    } catch {
      log("error", `Error creating ${addingType}`);
    }
  }

  async function deleteNode() {
    if (!selectedNode) return;
    const endpoint =
      selectedNode.type === "domain"
        ? `/api/taxonomy/domains/${selectedNode.id}`
        : selectedNode.type === "sector"
          ? `/api/taxonomy/sectors/${selectedNode.id}`
          : `/api/taxonomy/microsectors/${selectedNode.id}`;

    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        log("info", `Deleted ${selectedNode.type} ${selectedNode.id}`);
        setSelectedNode(null);
        setDeleteConfirm(false);
        await fetchTree();
      }
    } catch {
      log("error", `Error deleting ${selectedNode.type}`);
    }
  }

  /* ── Entity actions ────────────────────────────────────────────────── */

  async function updateEntityStatus(id: number, status: string) {
    try {
      const res = await fetch(`/api/entities/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        log("info", `Entity ${id} status → ${status}`);
        await fetchEntities(entityPage);
      }
    } catch {
      log("error", `Failed to update entity ${id}`);
    }
  }

  async function createEntity() {
    try {
      const body: Record<string, unknown> = {
        canonical_name: addEntityForm.canonical_name,
        entity_type: addEntityForm.entity_type,
      };
      if (addEntityForm.aliases.trim()) {
        body.aliases = addEntityForm.aliases.split(",").map((a) => a.trim()).filter(Boolean);
      }
      const res = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        log("info", `Created entity: ${addEntityForm.canonical_name}`);
        setAddEntityForm({ canonical_name: "", entity_type: "company", aliases: "" });
        setAddEntityOpen(false);
        await fetchEntities(1);
      }
    } catch {
      log("error", "Failed to create entity");
    }
  }

  function toggleEntityExpand(id: number) {
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ── Channel actions ───────────────────────────────────────────────── */

  async function createChannel() {
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_domain_id: Number(addChannelForm.source_domain_id),
          target_domain_id: Number(addChannelForm.target_domain_id),
          label: addChannelForm.label,
          description: addChannelForm.description || null,
          mechanism: addChannelForm.mechanism || null,
          strength: addChannelForm.strength,
        }),
      });
      if (res.ok) {
        log("info", `Created channel: ${addChannelForm.label}`);
        setAddChannelForm({
          source_domain_id: "",
          target_domain_id: "",
          label: "",
          description: "",
          mechanism: "",
          strength: "moderate",
        });
        await fetchChannels();
      }
    } catch {
      log("error", "Failed to create channel");
    }
  }

  async function deleteChannel(id: number) {
    try {
      const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
      if (res.ok) {
        log("info", `Deleted channel ${id}`);
        await fetchChannels();
      }
    } catch {
      log("error", `Failed to delete channel ${id}`);
    }
  }

  function toggleChannelExpand(id: number) {
    setExpandedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ── Keyword editing helpers ───────────────────────────────────────── */

  function removeKeyword(kw: string) {
    if (!Array.isArray(editForm.keywords)) return;
    setEditForm((prev) => ({
      ...prev,
      keywords: (prev.keywords as string[]).filter((k) => k !== kw),
    }));
  }

  function addKeyword(kw: string) {
    if (!kw.trim()) return;
    setEditForm((prev) => ({
      ...prev,
      keywords: [...((prev.keywords as string[]) ?? []), kw.trim()],
    }));
  }

  /* ── Render helpers ────────────────────────────────────────────────── */

  const enrichProgressPct = enrichProgress
    ? Math.round((enrichProgress.articlesProcessed / Math.max(enrichProgress.totalArticles, 1)) * 100)
    : 0;

  // Find the selected node data for the detail panel
  const selectedDomain = selectedNode?.type === "domain" ? tree.find((d) => d.id === selectedNode.id) : null;
  const selectedSector = selectedNode?.type === "sector"
    ? (() => { for (const d of tree) { const s = d.sectors.find((x) => x.id === selectedNode.id); if (s) return s; } return null; })()
    : null;

  // Helper to get sentiment count by name
  const getSentimentCount = (name: string): number => {
    if (!enrichStats) return 0;
    const found = enrichStats.sentiment_distribution.find((s) => s.sentiment === name);
    return found?.count ?? 0;
  };

  // Sentiment bar max for normalization
  const sentimentMax = enrichStats
    ? Math.max(
        ...enrichStats.sentiment_distribution.map((s) => s.count),
        1
      )
    : 1;

  const signalMax = enrichStats?.signal_distribution.length
    ? Math.max(...enrichStats.signal_distribution.map((s) => s.count), 1)
    : 1;

  /* ══════════════════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6 p-5">
      {/* ── Enrichment control bar ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={runEnrichment}
          disabled={isEnriching}
          size="sm"
          className="gap-2"
        >
          {isEnriching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isEnriching ? "Running..." : "Run Enrichment"}
        </Button>

        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          {enrichStats && (
            <>
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-status-success" />
                {enrichStats.total_enriched} enriched
              </span>
              {enrichStats.unenriched_count > 0 && (
                <span className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3 text-status-warning" />
                  {enrichStats.unenriched_count} unenriched
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3 text-status-info" />
                {enrichStats.entity_count} entities
              </span>
              <span className="flex items-center gap-1 font-mono">
                ${enrichStats.estimated_cost_usd.toFixed(4)} cost
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Enrichment progress ──────────────────────────────────────── */}
      {enrichProgress && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-lg border border-border-accent bg-accent-emerald/5 px-4 py-3"
        >
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-accent-emerald" />
              <span>
                {enrichProgress.articlesProcessed} articles processed
                {enrichProgress.errors > 0 && (
                  <span className="ml-2 text-status-error">{enrichProgress.errors} errors</span>
                )}
              </span>
            </span>
            <span className="font-mono text-muted-foreground">
              ${enrichProgress.totalCost.toFixed(4)} cost
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full bg-accent-emerald"
              initial={{ width: 0 }}
              animate={{ width: `${enrichProgressPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}

      {enrichError && (
        <div className="rounded-lg border border-status-error/30 bg-status-error/5 px-4 py-3">
          <p className="text-sm text-status-error">{enrichError}</p>
        </div>
      )}

      {/* ── Sub-tab navigation ───────────────────────────────────────── */}
      <Tabs value={subTab} onValueChange={(v) => { setSubTab(v); log("info", `Taxonomy sub-tab: ${v}`); }}>
        <TabsList className="mb-4 w-full justify-start gap-0 rounded-none border-b border-border/40 bg-transparent p-0">
          <TabsTrigger
            value="tree"
            className="relative gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-active:border-b-accent-emerald data-active:text-foreground data-active:shadow-none"
          >
            <GitBranch className="h-4 w-4" />
            <span className="hidden sm:inline">Taxonomy Tree</span>
          </TabsTrigger>
          <TabsTrigger
            value="entities"
            className="relative gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-active:border-b-accent-emerald data-active:text-foreground data-active:shadow-none"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Entities</span>
          </TabsTrigger>
          <TabsTrigger
            value="signals"
            className="relative gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-active:border-b-accent-emerald data-active:text-foreground data-active:shadow-none"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Signals & Sentiment</span>
          </TabsTrigger>
          <TabsTrigger
            value="channels"
            className="relative gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-active:border-b-accent-emerald data-active:text-foreground data-active:shadow-none"
          >
            <Network className="h-4 w-4" />
            <span className="hidden sm:inline">Channels</span>
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════════════════
           Section 1: Taxonomy Tree
           ════════════════════════════════════════════════════════════════ */}
        <TabsContent value="tree" className="m-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {treeLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
                {/* Left: Tree */}
                <Card className="border-border/40">
                  <CardContent className="p-0">
                    <ScrollArea className="h-[600px]">
                      <div className="p-3 space-y-0.5">
                        {tree.map((domain) => {
                          const domainExpanded = expandedDomains.has(domain.id);
                          const domainSelected = selectedNode?.type === "domain" && selectedNode.id === domain.id;
                          return (
                            <div key={domain.id}>
                              <button
                                onClick={() => {
                                  toggleDomain(domain.id);
                                  selectTreeNode({ type: "domain", id: domain.id });
                                }}
                                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2 ${
                                  domainSelected ? "bg-surface-2" : ""
                                }`}
                              >
                                {domainExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                )}
                                <span className="flex-1 truncate font-medium text-accent-emerald">
                                  {domain.name}
                                </span>
                                <Badge variant="secondary" className="shrink-0 text-[10px] font-mono">
                                  {domain.article_count}
                                </Badge>
                              </button>

                              {domainExpanded && domain.sectors.map((sector) => {
                                const sectorExpanded = expandedSectors.has(sector.id);
                                const sectorSelected = selectedNode?.type === "sector" && selectedNode.id === sector.id;
                                return (
                                  <div key={sector.id}>
                                    <button
                                      onClick={() => {
                                        toggleSector(sector.id);
                                        selectTreeNode({ type: "sector", id: sector.id });
                                      }}
                                      className={`flex w-full items-center gap-2 rounded-md py-1.5 pl-7 pr-2 text-left text-sm transition-colors hover:bg-surface-2 ${
                                        sectorSelected ? "bg-surface-2" : ""
                                      }`}
                                    >
                                      {sector.microsectors.length > 0 ? (
                                        sectorExpanded ? (
                                          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                                        )
                                      ) : (
                                        <span className="w-3 shrink-0" />
                                      )}
                                      <span className="flex-1 truncate">{sector.name}</span>
                                      <Badge variant="secondary" className="shrink-0 text-[10px] font-mono">
                                        {sector.article_count}
                                      </Badge>
                                    </button>

                                    {sectorExpanded && sector.microsectors.map((ms) => {
                                      const msSelected = selectedNode?.type === "microsector" && selectedNode.id === ms.id;
                                      return (
                                        <button
                                          key={ms.id}
                                          onClick={() => selectTreeNode({ type: "microsector", id: ms.id })}
                                          className={`flex w-full items-center gap-2 rounded-md py-1.5 pl-14 pr-2 text-left text-xs transition-colors hover:bg-surface-2 ${
                                            msSelected ? "bg-surface-2" : ""
                                          }`}
                                        >
                                          <span className="flex-1 truncate text-muted-foreground">
                                            {ms.name}
                                          </span>
                                          <Badge variant="secondary" className="shrink-0 text-[10px] font-mono">
                                            {ms.article_count}
                                          </Badge>
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>

                      <div className="border-t border-border/40 p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 text-xs"
                          onClick={() => {
                            setAddingType("domain");
                            setSelectedNode(null);
                            setAddForm({ slug: "", name: "", description: "" });
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Domain
                        </Button>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Right: Detail/Edit */}
                <Card className="border-border/40">
                  <CardContent className="p-5">
                    {addingType && !selectedNode ? (
                      /* ── Add domain form ──────────────────────────── */
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium">Add New Domain</h3>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Slug</Label>
                            <Input
                              value={addForm.slug}
                              onChange={(e) => setAddForm((p) => ({ ...p, slug: e.target.value }))}
                              placeholder="e.g. energy-policy"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={addForm.name}
                              onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                              placeholder="e.g. Energy Policy"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Description</Label>
                            <textarea
                              value={addForm.description}
                              onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
                              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              rows={3}
                              placeholder="Description..."
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={addNode} className="gap-2">
                              <Plus className="h-3.5 w-3.5" />
                              Create Domain
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAddingType(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : addingType && selectedNode ? (
                      /* ── Add sector/microsector form ──────────────── */
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium">
                          Add New {addingType === "sector" ? "Sector" : "Micro-Sector"}
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Slug</Label>
                            <Input
                              value={addForm.slug}
                              onChange={(e) => setAddForm((p) => ({ ...p, slug: e.target.value }))}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={addForm.name}
                              onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Description</Label>
                            <textarea
                              value={addForm.description}
                              onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
                              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              rows={3}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={addNode} className="gap-2">
                              <Plus className="h-3.5 w-3.5" />
                              Create {addingType === "sector" ? "Sector" : "Micro-Sector"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setAddingType(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : selectedNode ? (
                      /* ── Edit node form ───────────────────────────── */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="flex items-center gap-2 text-sm font-medium">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            Edit {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)}
                          </h3>
                          <Badge variant="outline" className="text-[10px]">
                            {selectedNode.type}
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={String(editForm.name ?? "")}
                              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Slug</Label>
                            <Input
                              value={String(editForm.slug ?? "")}
                              disabled
                              className="mt-1 bg-muted"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Description</Label>
                            <textarea
                              value={String(editForm.description ?? "")}
                              onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              rows={3}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Sort Order</Label>
                            <Input
                              type="number"
                              value={String(editForm.sort_order ?? 0)}
                              onChange={(e) => setEditForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                              className="mt-1 w-24"
                            />
                          </div>

                          {/* Parent info (read-only) */}
                          {editForm.parent_domain && (
                            <div>
                              <Label className="text-xs">Parent Domain</Label>
                              <Input value={String(editForm.parent_domain)} disabled className="mt-1 bg-muted" />
                            </div>
                          )}
                          {editForm.parent_sector && (
                            <div>
                              <Label className="text-xs">Parent Sector</Label>
                              <Input value={String(editForm.parent_sector)} disabled className="mt-1 bg-muted" />
                            </div>
                          )}

                          {/* Keywords (microsector only) */}
                          {selectedNode.type === "microsector" && Array.isArray(editForm.keywords) && (
                            <div>
                              <Label className="text-xs">Keywords</Label>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {(editForm.keywords as string[]).map((kw) => (
                                  <Badge
                                    key={kw}
                                    variant="outline"
                                    className="gap-1 text-[10px]"
                                  >
                                    {kw}
                                    <button onClick={() => removeKeyword(kw)} className="ml-0.5 hover:text-status-error">
                                      <X className="h-2.5 w-2.5" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                              <div className="mt-2 flex gap-2">
                                <Input
                                  placeholder="Add keyword..."
                                  className="h-8 text-xs"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      addKeyword((e.target as HTMLInputElement).value);
                                      (e.target as HTMLInputElement).value = "";
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Article count stat */}
                          {selectedNode.type === "microsector" && editForm.article_count !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              {String(editForm.article_count)} linked articles
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-4">
                          <Button size="sm" onClick={saveNode} disabled={saving} className="gap-2">
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Save Changes
                          </Button>

                          {selectedNode.type === "domain" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => {
                                setAddingType("sector");
                                setAddForm({ slug: "", name: "", description: "" });
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add Sector
                            </Button>
                          )}

                          {selectedNode.type === "sector" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => {
                                setAddingType("microsector");
                                setAddForm({ slug: "", name: "", description: "" });
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add Micro-Sector
                            </Button>
                          )}

                          <div className="ml-auto">
                            {deleteConfirm ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-status-error">Confirm delete?</span>
                                <Button size="sm" variant="destructive" onClick={deleteNode} className="gap-1 text-xs">
                                  <Trash2 className="h-3 w-3" />
                                  Yes, delete
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(false)} className="text-xs">
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-xs text-status-error hover:bg-status-error/10"
                                onClick={() => setDeleteConfirm(true)}
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ── Empty state ──────────────────────────────── */
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <GitBranch className="mb-3 h-10 w-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                          Select a node from the tree to view and edit its details.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════
           Section 2: Entities
           ════════════════════════════════════════════════════════════════ */}
        <TabsContent value="entities" className="m-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Add entity form (collapsible) */}
            <div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => setAddEntityOpen(!addEntityOpen)}
              >
                {addEntityOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {addEntityOpen ? "Close" : "Add Entity"}
              </Button>

              {addEntityOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3"
                >
                  <Card className="border-border/40">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={addEntityForm.canonical_name}
                            onChange={(e) => setAddEntityForm((p) => ({ ...p, canonical_name: e.target.value }))}
                            placeholder="Entity name"
                            className="mt-1 w-48"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={addEntityForm.entity_type}
                            onValueChange={(v) => setAddEntityForm((p) => ({ ...p, entity_type: v }))}
                          >
                            <SelectTrigger className="mt-1 h-9 w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["company", "project", "regulation", "person", "technology"].map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t.charAt(0).toUpperCase() + t.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Aliases (comma-separated)</Label>
                          <Input
                            value={addEntityForm.aliases}
                            onChange={(e) => setAddEntityForm((p) => ({ ...p, aliases: e.target.value }))}
                            placeholder="alias1, alias2"
                            className="mt-1 w-56"
                          />
                        </div>
                        <Button size="sm" onClick={createEntity} className="gap-2">
                          <Plus className="h-3.5 w-3.5" />
                          Create
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3">
              <Select value={entityTypeFilter} onValueChange={(v) => { setEntityTypeFilter(v); setEntityPage(1); }}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Types</SelectItem>
                  {["company", "project", "regulation", "person", "technology"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={entityStatusFilter} onValueChange={(v) => { setEntityStatusFilter(v); setEntityPage(1); }}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Status</SelectItem>
                  {["candidate", "promoted", "archived", "dormant"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") fetchEntities(1); }}
                  placeholder="Search entities..."
                  className="h-8 w-[200px] pl-8 text-xs"
                />
              </div>

              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => fetchEntities(1)}>
                <Search className="mr-1.5 h-3 w-3" />
                Search
              </Button>
            </div>

            {/* Entity table */}
            {entityLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : entities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No entities found.</p>
              </div>
            ) : (
              <Card className="border-border/40">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/40">
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</th>
                          <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Aliases</th>
                          <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Mentions</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">First Seen</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entities.map((entity) => {
                          const isExpanded = expandedEntities.has(entity.id);
                          const TypeIcon = ENTITY_TYPE_ICONS[entity.entity_type] ?? Tag;
                          return (
                            <React.Fragment key={entity.id}>
                              <tr
                                className="border-b border-border/20 transition-colors hover:bg-surface-2/50 cursor-pointer"
                                onClick={() => toggleEntityExpand(entity.id)}
                              >
                                <td className="px-4 py-2.5 font-medium">{entity.canonical_name}</td>
                                <td className="px-4 py-2.5">
                                  <Badge variant="outline" className={`gap-1 text-[10px] ${ENTITY_TYPE_COLORS[entity.entity_type] ?? ""}`}>
                                    <TypeIcon className="h-2.5 w-2.5" />
                                    {entity.entity_type}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5 text-center font-mono text-xs text-muted-foreground">{entity.aliases?.length ?? 0}</td>
                                <td className="px-4 py-2.5 text-center font-mono text-xs">{entity.mentions}</td>
                                <td className="px-4 py-2.5">
                                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[entity.status] ?? ""}`}>
                                    {entity.status}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(entity.first_seen)}</td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {entity.status === "candidate" && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 w-7 p-0"
                                            onClick={(e) => { e.stopPropagation(); updateEntityStatus(entity.id, "promoted"); }}
                                          >
                                            <Check className="h-3 w-3 text-accent-emerald" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Promote</TooltipContent>
                                      </Tooltip>
                                    )}
                                    {entity.status !== "archived" && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 w-7 p-0"
                                            onClick={(e) => { e.stopPropagation(); updateEntityStatus(entity.id, "archived"); }}
                                          >
                                            <X className="h-3 w-3 text-muted-foreground" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Archive</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </td>
                              </tr>

                              {isExpanded && (
                                <tr className="border-b border-border/20 bg-surface-2/30">
                                  <td colSpan={7} className="px-4 py-3">
                                    <div className="space-y-2 text-xs">
                                      <div>
                                        <span className="font-medium text-muted-foreground">Aliases: </span>
                                        {entity.aliases?.length > 0 ? (
                                          <span className="flex flex-wrap gap-1 mt-1">
                                            {entity.aliases.map((a) => (
                                              <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>
                                            ))}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">None</span>
                                        )}
                                      </div>
                                      {entity.metadata && (
                                        <div>
                                          <span className="font-medium text-muted-foreground">Metadata: </span>
                                          <code className="mt-1 block rounded bg-surface-2 p-2 text-[10px] font-mono">
                                            {JSON.stringify(entity.metadata, null, 2)}
                                          </code>
                                        </div>
                                      )}
                                      <div>
                                        <span className="font-medium text-muted-foreground">
                                          Linked articles: {entity.linked_articles}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {entityPagination && entityPagination.total_pages > 1 && (
                    <div className="flex items-center justify-between border-t border-border/40 px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={entityPage <= 1}
                        onClick={() => fetchEntities(entityPage - 1)}
                        className="text-xs"
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {entityPage} of {entityPagination.total_pages} ({entityPagination.total} total)
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={entityPage >= entityPagination.total_pages}
                        onClick={() => fetchEntities(entityPage + 1)}
                        className="text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </motion.div>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════
           Section 3: Signals & Sentiment
           ════════════════════════════════════════════════════════════════ */}
        <TabsContent value="signals" className="m-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Stats cards */}
            {enrichStats && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border/40">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Total Enriched</p>
                    <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{enrichStats.total_enriched}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/40">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Total Entities</p>
                    <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{enrichStats.entity_count}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/40">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Estimated Cost</p>
                    <p className="mt-1 font-display text-2xl font-semibold tracking-tight font-mono">${enrichStats.estimated_cost_usd.toFixed(4)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/40">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Most Common Signal</p>
                    <p className="mt-1 text-lg font-semibold tracking-tight">{enrichStats.signal_distribution[0]?.signal?.replace(/_/g, " ") ?? "—"}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Charts side by side */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Signal Distribution */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Signal Type Distribution
                </h3>
                <Card className="border-border/40">
                  <CardContent className="p-4">
                    {enrichStats && enrichStats.signal_distribution.length > 0 ? (
                      <div className="space-y-2">
                        {enrichStats.signal_distribution.map((sig) => {
                          const pct = (sig.count / signalMax) * 100;
                          const sigKey = sig.signal ?? "";
                          const barColor = SIGNAL_COLORS[sigKey] ?? SIGNAL_COLORS.default;
                          return (
                            <div key={sigKey} className="flex items-center gap-3 px-2 py-1.5">
                              <span className="w-32 shrink-0 truncate text-xs font-medium">
                                {sigKey.replace(/_/g, " ")}
                              </span>
                              <div className="flex-1">
                                <div className="h-4 w-full rounded-sm bg-surface-2">
                                  <div
                                    className={`h-full rounded-sm ${barColor} transition-all duration-300`}
                                    style={{ width: `${Math.max(pct, 2)}%` }}
                                  />
                                </div>
                              </div>
                              <span className="w-8 text-right font-mono text-xs text-muted-foreground">
                                {sig.count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No signal data yet. Run enrichment to generate signals.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sentiment Distribution */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Sentiment Distribution
                </h3>
                <Card className="border-border/40">
                  <CardContent className="p-4">
                    {enrichStats ? (
                      <div className="space-y-2">
                        {[
                          { label: "Positive", value: getSentimentCount("positive"), color: "bg-accent-emerald" },
                          { label: "Negative", value: getSentimentCount("negative"), color: "bg-status-error" },
                          { label: "Neutral", value: getSentimentCount("neutral"), color: "bg-muted-foreground" },
                          { label: "Mixed", value: getSentimentCount("mixed"), color: "bg-accent-amber" },
                        ].map((item) => {
                          const pct = (item.value / sentimentMax) * 100;
                          return (
                            <div key={item.label} className="flex items-center gap-3 px-2 py-1.5">
                              <span className="w-20 shrink-0 text-xs font-medium">{item.label}</span>
                              <div className="flex-1">
                                <div className="h-4 w-full rounded-sm bg-surface-2">
                                  <div
                                    className={`h-full rounded-sm ${item.color} transition-all duration-300`}
                                    style={{ width: `${Math.max(pct, 2)}%` }}
                                  />
                                </div>
                              </div>
                              <span className="w-8 text-right font-mono text-xs text-muted-foreground">
                                {item.value}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No sentiment data yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════
           Section 4: Channels
           ════════════════════════════════════════════════════════════════ */}
        <TabsContent value="channels" className="m-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Add channel form */}
            <Card className="border-border/40">
              <CardContent className="p-4">
                <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  Add Transmission Channel
                </h3>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <Label className="text-xs">Source Domain</Label>
                    <Select
                      value={addChannelForm.source_domain_id}
                      onValueChange={(v) => setAddChannelForm((p) => ({ ...p, source_domain_id: v }))}
                    >
                      <SelectTrigger className="mt-1 h-9 w-44">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tree.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Target Domain</Label>
                    <Select
                      value={addChannelForm.target_domain_id}
                      onValueChange={(v) => setAddChannelForm((p) => ({ ...p, target_domain_id: v }))}
                    >
                      <SelectTrigger className="mt-1 h-9 w-44">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tree.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={addChannelForm.label}
                      onChange={(e) => setAddChannelForm((p) => ({ ...p, label: e.target.value }))}
                      placeholder="Channel label"
                      className="mt-1 w-40"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Strength</Label>
                    <Select
                      value={addChannelForm.strength}
                      onValueChange={(v) => setAddChannelForm((p) => ({ ...p, strength: v as "weak" | "moderate" | "strong" }))}
                    >
                      <SelectTrigger className="mt-1 h-9 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weak">Weak</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="strong">Strong</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" onClick={createChannel} className="gap-2">
                    <Plus className="h-3.5 w-3.5" />
                    Add Channel
                  </Button>
                </div>

                {/* Additional fields */}
                <div className="mt-3 flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs">Description</Label>
                    <textarea
                      value={addChannelForm.description}
                      onChange={(e) => setAddChannelForm((p) => ({ ...p, description: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={2}
                      placeholder="Description (optional)"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs">Mechanism</Label>
                    <textarea
                      value={addChannelForm.mechanism}
                      onChange={(e) => setAddChannelForm((p) => ({ ...p, mechanism: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      rows={2}
                      placeholder="Mechanism (optional)"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Channels table */}
            {channelsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : channels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Network className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No transmission channels yet.</p>
              </div>
            ) : (
              <Card className="border-border/40">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/40">
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Source</th>
                          <th className="px-2 py-2.5 text-center text-xs text-muted-foreground"><ArrowRight className="mx-auto h-3.5 w-3.5" /></th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Target</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Label</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Strength</th>
                          <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Active</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channels.map((ch) => {
                          const isExpanded = expandedChannels.has(ch.id);
                          return (
                            <React.Fragment key={ch.id}>
                              <tr
                                className="border-b border-border/20 transition-colors hover:bg-surface-2/50 cursor-pointer"
                                onClick={() => toggleChannelExpand(ch.id)}
                              >
                                <td className="px-4 py-2.5 font-medium">{ch.source_domain_name}</td>
                                <td className="px-2 py-2.5 text-center">
                                  <ArrowRight className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                                </td>
                                <td className="px-4 py-2.5 font-medium">{ch.target_domain_name}</td>
                                <td className="px-4 py-2.5 text-xs">{ch.label}</td>
                                <td className="px-4 py-2.5">
                                  <Badge variant="outline" className={`text-[10px] ${STRENGTH_COLORS[ch.strength] ?? ""}`}>
                                    {ch.strength}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {ch.is_active ? (
                                    <Check className="mx-auto h-4 w-4 text-accent-emerald" />
                                  ) : (
                                    <X className="mx-auto h-4 w-4 text-muted-foreground" />
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id); }}
                                      >
                                        <Trash2 className="h-3 w-3 text-status-error" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete</TooltipContent>
                                  </Tooltip>
                                </td>
                              </tr>

                              {isExpanded && (
                                <tr className="border-b border-border/20 bg-surface-2/30">
                                  <td colSpan={7} className="px-4 py-3">
                                    <div className="space-y-2 text-xs">
                                      {ch.description && (
                                        <div>
                                          <span className="font-medium text-muted-foreground">Description: </span>
                                          <span>{ch.description}</span>
                                        </div>
                                      )}
                                      {ch.mechanism && (
                                        <div>
                                          <span className="font-medium text-muted-foreground">Mechanism: </span>
                                          <span>{ch.mechanism}</span>
                                        </div>
                                      )}
                                      {!ch.description && !ch.mechanism && (
                                        <span className="text-muted-foreground">No additional details.</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
