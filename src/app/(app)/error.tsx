"use client";

// Route-group error boundary for the authenticated app. Without this, an
// unhandled render error in any dashboard tab unmounted the whole route to
// Next's generic "Application error" with no recovery. This catches it and
// offers a reset + an escape hatch back to the launchpad.

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] route error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        This section hit an unexpected error. Your account and data are safe —
        try again, or head back to your launchpad.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Try again
        </button>
        <a
          href="/launchpad"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground"
        >
          Back to launchpad
        </a>
      </div>
    </div>
  );
}
