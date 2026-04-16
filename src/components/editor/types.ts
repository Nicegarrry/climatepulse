// Types specific to the Editor tab UI.
// Kept here to avoid bloating src/lib/types.ts with editor-only shapes.

export interface EditorArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  published_at: string | null;
  domain: string | null;
  secondary_domain: string | null;
  signal_type: string | null;
  sentiment: string | null;
  significance: number;
  quantitative_data: {
    primary_metric?: { value: string; unit: string; context: string } | null;
    delta?: { value: string; unit: string; period: string } | null;
  } | null;
  entities: { name: string; type: string }[];
}

export interface EditorArticleSearchParams {
  from: string;
  to: string;
  domain?: string;
  minSignificance?: number;
  limit?: number;
}
