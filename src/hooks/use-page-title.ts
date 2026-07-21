import { useEffect } from "react";
import { SITE } from "@/lib/site";

/**
 * Sets the document title for the current route.
 *
 * Without this every tab, history entry, and bookmark reads the bare
 * index.html title, so three open views of the app are indistinguishable.
 * Pass nothing for the landing page's product-level title.
 */
export function usePageTitle(page?: string) {
  useEffect(() => {
    document.title = page
      ? `${page} · ${SITE.product}`
      : `${SITE.product} — ${SITE.tagline}`;
  }, [page]);
}
