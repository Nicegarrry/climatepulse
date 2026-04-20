/**
 * Public-facing Knowledge Surface route: /s/[slug]
 *
 * Flow:
 *   1. Fetch surface by slug (archived → 404, not-found → 404).
 *   2. Resolve access against the current viewer.
 *   3. Branch on decision:
 *        - needs_sign_in       → redirect /login?next=/s/<slug>
 *        - archived / missing  → notFound()
 *        - not_authorised +
 *          requires cohort     → render <CohortCodeForm>
 *        - not_authorised else → render contact-owner message
 *        - allowed             → dispatch by template
 *   4. Fire a `view` analytics event (fire-and-forget, never blocks).
 *
 * Unlisted surfaces set robots:{ index: false } in generateMetadata().
 */
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/supabase/server";
import { fetchSurfaceBySlug, resolveAccess, type Viewer } from "@/lib/surfaces/access";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { HubView } from "./HubView";
import { CourseView } from "./CourseView";
import { CohortCodeForm } from "./CohortCodeForm";
import { SurfaceAnalyticsBeacon } from "./SurfaceAnalyticsBeacon";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const surface = await fetchSurfaceBySlug(slug);
  if (!surface) return {};
  const description = surface.overlay.introduction?.slice(0, 160) ?? undefined;
  const meta: Metadata = {
    title: surface.title,
    description,
  };
  if (surface.access.kind === "unlisted") {
    meta.robots = { index: false, follow: false };
  }
  return meta;
}

export default async function SurfacePage(props: PageProps) {
  const { slug } = await props.params;
  const surface = await fetchSurfaceBySlug(slug);

  const user = await getAuthUser();
  const viewer: Viewer = {
    user_id: user?.id ?? null,
    email: user?.email ?? null,
  };

  const decision = await resolveAccess(surface, viewer);

  if (!decision.allowed) {
    if (decision.reason === "surface_not_found" || decision.reason === "archived") {
      notFound();
    }
    if (decision.reason === "needs_sign_in") {
      redirect(`/login?next=${encodeURIComponent(`/s/${slug}`)}`);
    }
    if (decision.reason === "not_authorised" && decision.requires === "cohort_code") {
      // surface is guaranteed non-null here (needs_sign_in / not_found ruled out)
      return (
        <AccessChrome>
          <CohortCodeForm slug={slug} title={surface?.title ?? "Protected surface"} />
        </AccessChrome>
      );
    }
    return (
      <AccessChrome>
        <div
          style={{
            fontFamily: FONTS.sans,
            color: COLORS.inkSec,
            fontSize: 14,
            lineHeight: 1.6,
            maxWidth: 480,
          }}
        >
          <h1
            style={{
              fontFamily: FONTS.serif,
              fontSize: 28,
              margin: "0 0 12px",
              color: COLORS.ink,
              fontWeight: 500,
            }}
          >
            You don&rsquo;t have access
          </h1>
          <p style={{ margin: 0 }}>
            This surface is restricted. If you believe you should have access,
            contact the surface owner for an invite.
          </p>
        </div>
      </AccessChrome>
    );
  }

  // Allowed — surface is non-null.
  const s = surface!;
  const primary = s.branding.primary_colour ?? COLORS.forest;
  const accent = s.branding.accent_colour ?? COLORS.plum;

  return (
    <div
      style={
        {
          minHeight: "100vh",
          background: COLORS.bg,
          color: COLORS.ink,
          fontFamily: FONTS.sans,
          // Expose branding as CSS custom properties for nested components.
          ["--surface-primary" as string]: primary,
          ["--surface-accent" as string]: accent,
        } as React.CSSProperties
      }
    >
      <SurfaceAnalyticsBeacon slug={s.slug} />
      {s.template === "course" ? (
        <CourseView surface={s} decision={decision} viewerUserId={viewer.user_id} />
      ) : (
        <HubView surface={s} decision={decision} viewerUserId={viewer.user_id} />
      )}
    </div>
  );
}

function AccessChrome({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      {children}
    </div>
  );
}
