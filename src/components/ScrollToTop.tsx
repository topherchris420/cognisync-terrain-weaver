import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Resets the scroll position when navigating to a new page.
 *
 * BrowserRouter keeps the previous page's scroll offset, so following a footer
 * link opened the next page scrolled to its bottom. Back/forward (POP) is left
 * alone -- the browser's native scroll restoration handles history traversal.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== "POP") {
      window.scrollTo(0, 0);
    }
  }, [pathname, navigationType]);

  return null;
}
