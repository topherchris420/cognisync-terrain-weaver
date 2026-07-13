import { Loader2 } from "lucide-react";

/** Full-viewport fallback shown while a lazy-loaded route chunk downloads. */
export function PageLoader() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
      aria-label="Loading page"
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
