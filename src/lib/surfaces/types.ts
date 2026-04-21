// Shared types for the Knowledge Surfaces primitive (Phase 4).
// Mirrors the CHECK constraints and JSONB shapes in
// scripts/migrations/learn/040-knowledge-surfaces.sql — keep in sync.

export type SurfaceTemplate = "hub" | "course";
export type SurfaceLifecycle = "draft" | "preview" | "published" | "archived";

export type AccessKind =
  | "public"
  | "unlisted"
  | "authenticated"
  | "email_allowlist"
  | "domain_allowlist"
  | "cohort_code";

export type AccessLevel = "viewer" | "contributor" | "admin";

export type ContentKind = "uploaded_doc" | "custom_module" | "custom_quiz";
export type Confidentiality = "private" | "public_within_surface";

export type AnalyticsMetric =
  | "view"
  | "path_start"
  | "path_complete"
  | "item_complete"
  | "quiz_score"
  | "search"
  | "export";

export interface SurfaceScope {
  microsector_ids?: number[];
  entity_ids?: number[];
  domain_slugs?: string[];
  time_window?: {
    from?: string | null;
    to?: string | null;
    rolling_days?: number | null;
  };
  source_types?: string[];
  editor_status_filter?: string[];
}

export interface SurfaceAccess {
  kind: AccessKind;
  emails?: string[];
  domains?: string[];
  /** SHA-256 hex of the cohort code; never stored in plaintext. */
  cohort_code_hash?: string;
}

export interface SurfaceOverlay {
  introduction?: string | null;
  editor_note?: string | null;
  custom_modules?: Array<{
    id: string;
    title: string;
    body?: string;
    body_json?: Record<string, unknown>;
    position?: number;
  }>;
  custom_quizzes?: Array<{
    id: string;
    title: string;
    questions: Array<{
      prompt: string;
      answers: string[];
      correct_index: number;
    }>;
  }>;
  external_links?: Array<{ label: string; url: string }>;
  /** Pins specific versions of concept cards / brief blocks. See edge-case #6. */
  pinned_versions?: {
    concept_cards?: Record<string, number>;
    brief_blocks?: Record<string, number>;
  };
}

export interface SurfaceLayout {
  hero?: "concept" | "path" | "intro" | "none";
  show_search?: boolean;
  show_browse?: boolean;
  show_feed?: boolean;
  order?: Array<"intro" | "feed" | "featured_paths" | "browse" | "search">;
  /** Course template: cohort of chapters. */
  chapters?: Array<{
    label: string;
    path_slug?: string;
    item_ids?: string[];
    note?: string | null;
  }>;
}

export interface SurfaceBranding {
  primary_colour?: string | null;
  accent_colour?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  font_family?: string | null;
  custom_css?: string | null;
}

export interface KnowledgeSurface {
  id: string;
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
  version: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
}

export interface SurfaceContent {
  id: string;
  surface_id: string;
  content_kind: ContentKind;
  title: string;
  body: string | null;
  body_json: Record<string, unknown> | null;
  blob_url: string | null;
  blob_path: string | null;
  confidentiality: Confidentiality;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SurfaceMember {
  id: string;
  surface_id: string;
  user_id: string | null;
  email: string | null;
  domain: string | null;
  access_level: AccessLevel;
  redeemed_via_code: boolean;
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
}

export interface AccessDecision {
  allowed: boolean;
  reason:
    | "public"
    | "unlisted_ok"
    | "authenticated_ok"
    | "member_user"
    | "member_email"
    | "member_domain"
    | "cohort_redeemed"
    | "needs_sign_in"
    | "not_authorised"
    | "archived"
    | "surface_not_found";
  requires?: "sign_in" | "cohort_code" | "member_invite" | null;
  access_level?: AccessLevel;
}
