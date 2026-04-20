/**
 * Runtime validation for knowledge_surfaces JSONB fields.
 *
 * Zod-free on purpose — the project avoids adding dependencies when a short
 * hand-written validator does the job. Every writable surface field passes
 * through one of the validators here before touching the database.
 */
import type {
  AccessKind,
  KnowledgeSurface,
  SurfaceAccess,
  SurfaceBranding,
  SurfaceLayout,
  SurfaceLifecycle,
  SurfaceOverlay,
  SurfaceScope,
  SurfaceTemplate,
} from "./types";

export class SurfaceConfigError extends Error {
  constructor(
    message: string,
    public readonly field: string,
  ) {
    super(`[surfaces/config] ${field}: ${message}`);
    this.name = "SurfaceConfigError";
  }
}

const TEMPLATES: SurfaceTemplate[] = ["hub", "course"];
const LIFECYCLES: SurfaceLifecycle[] = ["draft", "preview", "published", "archived"];
const ACCESS_KINDS: AccessKind[] = [
  "public",
  "unlisted",
  "authenticated",
  "email_allowlist",
  "domain_allowlist",
  "cohort_code",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const HEX64_RE = /^[a-f0-9]{64}$/i;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validateSlug(slug: unknown): string {
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) {
    throw new SurfaceConfigError(
      "must be 1–63 chars of [a-z0-9-] starting and ending alphanumeric",
      "slug",
    );
  }
  return slug;
}

export function validateTemplate(t: unknown): SurfaceTemplate {
  if (typeof t !== "string" || !TEMPLATES.includes(t as SurfaceTemplate)) {
    throw new SurfaceConfigError(`must be one of ${TEMPLATES.join(" | ")}`, "template");
  }
  return t as SurfaceTemplate;
}

export function validateLifecycle(l: unknown): SurfaceLifecycle {
  if (typeof l !== "string" || !LIFECYCLES.includes(l as SurfaceLifecycle)) {
    throw new SurfaceConfigError(`must be one of ${LIFECYCLES.join(" | ")}`, "lifecycle");
  }
  return l as SurfaceLifecycle;
}

export function validateScope(raw: unknown): SurfaceScope {
  if (!isObject(raw)) throw new SurfaceConfigError("must be an object", "scope");
  const out: SurfaceScope = {};

  if (raw.microsector_ids != null) {
    if (!Array.isArray(raw.microsector_ids) || !raw.microsector_ids.every((n) => Number.isInteger(n) && (n as number) > 0)) {
      throw new SurfaceConfigError("must be int[] of microsector ids", "scope.microsector_ids");
    }
    out.microsector_ids = raw.microsector_ids as number[];
  }
  if (raw.entity_ids != null) {
    if (!Array.isArray(raw.entity_ids) || !raw.entity_ids.every((n) => Number.isInteger(n))) {
      throw new SurfaceConfigError("must be int[]", "scope.entity_ids");
    }
    out.entity_ids = raw.entity_ids as number[];
  }
  if (raw.domain_slugs != null) {
    if (!Array.isArray(raw.domain_slugs) || !raw.domain_slugs.every((s) => typeof s === "string")) {
      throw new SurfaceConfigError("must be string[]", "scope.domain_slugs");
    }
    out.domain_slugs = raw.domain_slugs as string[];
  }
  if (raw.time_window != null) {
    if (!isObject(raw.time_window)) {
      throw new SurfaceConfigError("must be an object", "scope.time_window");
    }
    const tw = raw.time_window;
    out.time_window = {
      from: typeof tw.from === "string" ? tw.from : null,
      to: typeof tw.to === "string" ? tw.to : null,
      rolling_days:
        typeof tw.rolling_days === "number" && tw.rolling_days > 0
          ? Math.floor(tw.rolling_days)
          : null,
    };
  }
  if (raw.source_types != null) {
    if (!Array.isArray(raw.source_types) || !raw.source_types.every((s) => typeof s === "string")) {
      throw new SurfaceConfigError("must be string[]", "scope.source_types");
    }
    out.source_types = raw.source_types as string[];
  }
  if (raw.editor_status_filter != null) {
    if (!Array.isArray(raw.editor_status_filter) || !raw.editor_status_filter.every((s) => typeof s === "string")) {
      throw new SurfaceConfigError("must be string[]", "scope.editor_status_filter");
    }
    out.editor_status_filter = raw.editor_status_filter as string[];
  }

  return out;
}

export function validateAccess(raw: unknown): SurfaceAccess {
  if (!isObject(raw)) throw new SurfaceConfigError("must be an object", "access");
  if (!ACCESS_KINDS.includes(raw.kind as AccessKind)) {
    throw new SurfaceConfigError(`kind must be one of ${ACCESS_KINDS.join(" | ")}`, "access.kind");
  }
  const kind = raw.kind as AccessKind;
  const out: SurfaceAccess = { kind };

  if (kind === "email_allowlist") {
    if (!Array.isArray(raw.emails) || raw.emails.length === 0) {
      throw new SurfaceConfigError("emails must be a non-empty array", "access.emails");
    }
    for (const e of raw.emails) {
      if (typeof e !== "string" || !EMAIL_RE.test(e)) {
        throw new SurfaceConfigError(`invalid email: ${String(e)}`, "access.emails");
      }
    }
    out.emails = (raw.emails as string[]).map((e) => e.trim().toLowerCase());
  }

  if (kind === "domain_allowlist") {
    if (!Array.isArray(raw.domains) || raw.domains.length === 0) {
      throw new SurfaceConfigError("domains must be a non-empty array", "access.domains");
    }
    for (const d of raw.domains) {
      if (typeof d !== "string" || !DOMAIN_RE.test(d)) {
        throw new SurfaceConfigError(`invalid domain: ${String(d)}`, "access.domains");
      }
    }
    out.domains = (raw.domains as string[]).map((d) => d.trim().toLowerCase());
  }

  if (kind === "cohort_code") {
    if (typeof raw.cohort_code_hash !== "string" || !HEX64_RE.test(raw.cohort_code_hash)) {
      throw new SurfaceConfigError(
        "must be a 64-char SHA-256 hex digest",
        "access.cohort_code_hash",
      );
    }
    out.cohort_code_hash = raw.cohort_code_hash.toLowerCase();
  }

  return out;
}

export function validateOverlay(raw: unknown): SurfaceOverlay {
  if (raw == null) return {};
  if (!isObject(raw)) throw new SurfaceConfigError("must be an object", "overlay");
  const out: SurfaceOverlay = {};

  if (raw.introduction != null) {
    if (typeof raw.introduction !== "string") {
      throw new SurfaceConfigError("must be string", "overlay.introduction");
    }
    out.introduction = raw.introduction;
  }
  if (raw.editor_note != null) {
    if (typeof raw.editor_note !== "string") {
      throw new SurfaceConfigError("must be string", "overlay.editor_note");
    }
    out.editor_note = raw.editor_note;
  }
  if (raw.custom_modules != null) {
    if (!Array.isArray(raw.custom_modules)) {
      throw new SurfaceConfigError("must be array", "overlay.custom_modules");
    }
    out.custom_modules = raw.custom_modules.map((m, i) => {
      if (!isObject(m) || typeof m.id !== "string" || typeof m.title !== "string") {
        throw new SurfaceConfigError(
          `entry ${i}: requires {id, title}`,
          "overlay.custom_modules",
        );
      }
      return {
        id: m.id,
        title: m.title,
        body: typeof m.body === "string" ? m.body : undefined,
        body_json: isObject(m.body_json) ? (m.body_json as Record<string, unknown>) : undefined,
        position: typeof m.position === "number" ? m.position : undefined,
      };
    });
  }
  if (raw.custom_quizzes != null) {
    if (!Array.isArray(raw.custom_quizzes)) {
      throw new SurfaceConfigError("must be array", "overlay.custom_quizzes");
    }
    out.custom_quizzes = raw.custom_quizzes.map((q, i) => {
      if (!isObject(q) || typeof q.id !== "string" || typeof q.title !== "string") {
        throw new SurfaceConfigError(`entry ${i}: requires {id, title}`, "overlay.custom_quizzes");
      }
      if (!Array.isArray(q.questions) || q.questions.length === 0) {
        throw new SurfaceConfigError(`entry ${i}: requires questions[]`, "overlay.custom_quizzes");
      }
      return {
        id: q.id,
        title: q.title,
        questions: (q.questions as unknown[]).map((qq, j) => {
          if (
            !isObject(qq) ||
            typeof qq.prompt !== "string" ||
            !Array.isArray(qq.answers) ||
            typeof qq.correct_index !== "number"
          ) {
            throw new SurfaceConfigError(
              `entry ${i} question ${j}: requires {prompt, answers[], correct_index}`,
              "overlay.custom_quizzes",
            );
          }
          return {
            prompt: qq.prompt,
            answers: (qq.answers as unknown[]).map(String),
            correct_index: qq.correct_index,
          };
        }),
      };
    });
  }
  if (raw.external_links != null) {
    if (!Array.isArray(raw.external_links)) {
      throw new SurfaceConfigError("must be array", "overlay.external_links");
    }
    out.external_links = raw.external_links.map((l, i) => {
      if (!isObject(l) || typeof l.label !== "string" || typeof l.url !== "string") {
        throw new SurfaceConfigError(
          `entry ${i}: requires {label, url}`,
          "overlay.external_links",
        );
      }
      return { label: l.label, url: l.url };
    });
  }
  if (raw.pinned_versions != null) {
    if (!isObject(raw.pinned_versions)) {
      throw new SurfaceConfigError("must be object", "overlay.pinned_versions");
    }
    const pv: SurfaceOverlay["pinned_versions"] = {};
    if (isObject(raw.pinned_versions.concept_cards)) {
      const cc: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw.pinned_versions.concept_cards)) {
        if (typeof v !== "number") {
          throw new SurfaceConfigError(
            `concept_cards[${k}] must be a version number`,
            "overlay.pinned_versions",
          );
        }
        cc[k] = v;
      }
      pv.concept_cards = cc;
    }
    if (isObject(raw.pinned_versions.brief_blocks)) {
      const bb: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw.pinned_versions.brief_blocks)) {
        if (typeof v !== "number") {
          throw new SurfaceConfigError(
            `brief_blocks[${k}] must be a version number`,
            "overlay.pinned_versions",
          );
        }
        bb[k] = v;
      }
      pv.brief_blocks = bb;
    }
    out.pinned_versions = pv;
  }

  return out;
}

export function validateLayout(raw: unknown): SurfaceLayout {
  if (raw == null) return {};
  if (!isObject(raw)) throw new SurfaceConfigError("must be an object", "layout");
  const out: SurfaceLayout = {};

  if (raw.hero != null) {
    if (!["concept", "path", "intro", "none"].includes(raw.hero as string)) {
      throw new SurfaceConfigError("invalid hero", "layout.hero");
    }
    out.hero = raw.hero as SurfaceLayout["hero"];
  }
  if (typeof raw.show_search === "boolean") out.show_search = raw.show_search;
  if (typeof raw.show_browse === "boolean") out.show_browse = raw.show_browse;
  if (typeof raw.show_feed === "boolean") out.show_feed = raw.show_feed;
  if (Array.isArray(raw.order)) {
    out.order = raw.order.filter(
      (v): v is NonNullable<SurfaceLayout["order"]>[number] =>
        typeof v === "string" &&
        ["intro", "feed", "featured_paths", "browse", "search"].includes(v),
    );
  }
  if (Array.isArray(raw.chapters)) {
    out.chapters = raw.chapters.map((c, i) => {
      if (!isObject(c) || typeof c.label !== "string") {
        throw new SurfaceConfigError(
          `entry ${i}: requires {label}`,
          "layout.chapters",
        );
      }
      return {
        label: c.label,
        path_slug: typeof c.path_slug === "string" ? c.path_slug : undefined,
        item_ids: Array.isArray(c.item_ids)
          ? (c.item_ids as unknown[]).filter((x): x is string => typeof x === "string")
          : undefined,
        note: typeof c.note === "string" ? c.note : null,
      };
    });
  }

  return out;
}

export function validateBranding(raw: unknown): SurfaceBranding {
  if (raw == null) return {};
  if (!isObject(raw)) throw new SurfaceConfigError("must be an object", "branding");
  const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  const out: SurfaceBranding = {};

  if (raw.primary_colour != null) {
    if (typeof raw.primary_colour !== "string" || !HEX.test(raw.primary_colour)) {
      throw new SurfaceConfigError("must be a hex colour", "branding.primary_colour");
    }
    out.primary_colour = raw.primary_colour;
  }
  if (raw.accent_colour != null) {
    if (typeof raw.accent_colour !== "string" || !HEX.test(raw.accent_colour)) {
      throw new SurfaceConfigError("must be a hex colour", "branding.accent_colour");
    }
    out.accent_colour = raw.accent_colour;
  }
  if (raw.logo_url != null) {
    if (typeof raw.logo_url !== "string") {
      throw new SurfaceConfigError("must be string", "branding.logo_url");
    }
    out.logo_url = raw.logo_url;
  }
  if (raw.favicon_url != null) {
    if (typeof raw.favicon_url !== "string") {
      throw new SurfaceConfigError("must be string", "branding.favicon_url");
    }
    out.favicon_url = raw.favicon_url;
  }
  if (raw.font_family != null) {
    if (typeof raw.font_family !== "string") {
      throw new SurfaceConfigError("must be string", "branding.font_family");
    }
    out.font_family = raw.font_family;
  }
  if (raw.custom_css != null) {
    if (typeof raw.custom_css !== "string") {
      throw new SurfaceConfigError("must be string", "branding.custom_css");
    }
    // Belt-and-braces: refuse anything with </style> or script tags.
    if (/<\/?\s*(script|style|iframe)\b/i.test(raw.custom_css)) {
      throw new SurfaceConfigError(
        "must not contain script/style/iframe tags",
        "branding.custom_css",
      );
    }
    out.custom_css = raw.custom_css;
  }

  return out;
}

export interface SurfaceUpsertInput {
  slug: string;
  title: string;
  template: SurfaceTemplate;
  scope?: unknown;
  access?: unknown;
  overlay?: unknown;
  layout?: unknown;
  branding?: unknown;
  lifecycle?: SurfaceLifecycle;
  owner_user_id: string;
}

export interface ValidatedSurfaceUpsert {
  slug: string;
  title: string;
  template: SurfaceTemplate;
  scope: SurfaceScope;
  access: SurfaceAccess;
  overlay: SurfaceOverlay;
  layout: SurfaceLayout;
  branding: SurfaceBranding;
  lifecycle: SurfaceLifecycle;
  owner_user_id: string;
}

export function validateUpsert(raw: SurfaceUpsertInput): ValidatedSurfaceUpsert {
  if (!raw.title || typeof raw.title !== "string") {
    throw new SurfaceConfigError("must be a non-empty string", "title");
  }
  if (!raw.owner_user_id || typeof raw.owner_user_id !== "string") {
    throw new SurfaceConfigError("must be a user_profiles.id", "owner_user_id");
  }
  return {
    slug: validateSlug(raw.slug),
    title: raw.title.trim(),
    template: validateTemplate(raw.template),
    scope: validateScope(raw.scope ?? {}),
    access: validateAccess(raw.access ?? { kind: "authenticated" }),
    overlay: validateOverlay(raw.overlay ?? {}),
    layout: validateLayout(raw.layout ?? {}),
    branding: validateBranding(raw.branding ?? {}),
    lifecycle: validateLifecycle(raw.lifecycle ?? "draft"),
    owner_user_id: raw.owner_user_id,
  };
}

/**
 * Deserialise a knowledge_surfaces row into the typed shape. Tolerant of
 * loose DB values (e.g. null JSONB columns) but throws if invariants break.
 */
export function parseSurface(row: Record<string, unknown>): KnowledgeSurface {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    template: validateTemplate(row.template),
    scope: validateScope(row.scope ?? {}),
    access: validateAccess(row.access ?? { kind: "authenticated" }),
    overlay: validateOverlay(row.overlay ?? {}),
    layout: validateLayout(row.layout ?? {}),
    branding: validateBranding(row.branding ?? {}),
    lifecycle: validateLifecycle(row.lifecycle),
    owner_user_id: row.owner_user_id as string,
    version: Number(row.version ?? 1),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    published_at: row.published_at ? String(row.published_at) : null,
    archived_at: row.archived_at ? String(row.archived_at) : null,
  };
}
