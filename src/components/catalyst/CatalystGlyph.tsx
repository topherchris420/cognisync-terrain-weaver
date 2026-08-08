import { cn } from "@/lib/utils";

interface CatalystGlyphProps {
  className?: string;
}

export function CatalystGlyph({ className }: CatalystGlyphProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-8 w-8 text-warning", className)}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 38c9-14 18-14 27-2 5 7 9 9 13 6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M10 28c9-10 18-11 28-2 6 5 11 6 16 3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.72"
      />
      <path
        d="M16 48c8-8 15-9 23-1 5 5 9 5 13 2"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M30 10c-6 9-5 17 3 24 7 6 8 12 3 20"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}
