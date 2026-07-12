import { useEffect, useRef } from "react";

/**
 * Adds an `is-visible` class to the element the first time it scrolls into
 * view, driving the `.reveal` CSS transition.
 *
 * A safety timeout always reveals the element after a short delay even if the
 * IntersectionObserver never fires (unsupported, disabled, or slow), so content
 * can never get stranded at opacity:0.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = () => el.classList.add("is-visible");

    // Guarantee visibility regardless of observer behaviour.
    const fallback = window.setTimeout(reveal, 1000);

    if (typeof IntersectionObserver === "undefined") {
      reveal();
      return () => window.clearTimeout(fallback);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(el);

    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);

  return ref;
}
