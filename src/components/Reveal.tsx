import type { ElementType, ReactNode } from "react";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger the reveal with a CSS transition delay (ms). */
  delay?: number;
  as?: ElementType;
}

/**
 * Wraps content so it fades and rises into view on first scroll.
 * Delay lets callers stagger sibling reveals.
 */
export function Reveal({ children, className, delay = 0, as: Tag = "div" }: RevealProps) {
  const ref = useReveal<HTMLElement>();

  return (
    <Tag
      ref={ref}
      className={cn("reveal", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
