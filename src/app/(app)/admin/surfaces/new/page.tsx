import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/supabase/server";
import { NewSurfaceWizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function NewSurfacePage() {
  const auth = await requireAuth();
  if ("error" in auth) {
    redirect("/login");
  }
  if (auth.profile.user_role !== "admin") {
    return (
      <div
        style={{
          padding: 40,
          fontFamily: "system-ui",
          color: "#333",
        }}
      >
        403 — Admin only.
      </div>
    );
  }
  return <NewSurfaceWizard />;
}
