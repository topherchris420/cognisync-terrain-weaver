import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "mark" | "full";
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

const iconSizes = {
  sm: 20,
  md: 28,
  lg: 36,
};

/**
 * Mannahatta Logo
 *
 * A professional mark combining:
 * - Water droplet (representing water resilience, absorption)
 * - Terrain layers (urban landscape)
 * - Shield motif (protection, resilience)
 *
 * The design uses a consistent teal/cyan palette matching the brand.
 */
export function Logo({ className, size = "md", variant = "full" }: LogoProps) {
  const iconSize = iconSizes[size];

  if (variant === "mark") {
    return (
      <div className={cn("relative flex items-center justify-center", sizeClasses[size], className)}>
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-md"
        >
          {/* Background shield/terrain shape */}
          <path
            d="M18 2L32 8V18C32 28 24 34 18 35C12 34 4 28 4 18V8L18 2Z"
            fill="url(#mark-gradient)"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-primary"
          />

          {/* Water drop element */}
          <path
            d="M18 8C18 8 12 15 12 19C12 22.5 14.8 25 18 25C21.2 25 24 22.5 24 19C24 15 18 8 18 8Z"
            fill="url(#water-gradient)"
            stroke="currentColor"
            strokeWidth="1"
            className="text-accent"
            opacity="0.9"
          />

          {/* Terrain layers */}
          <path
            d="M10 22L14 20L18 22L22 20L26 22"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-primary-foreground"
            opacity="0.7"
          />
          <path
            d="M8 26L13 24L18 26L23 24L28 26"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-primary-foreground"
            opacity="0.5"
          />

          {/* Absorption wave */}
          <path
            d="M14 16C14 16 16 14 18 16C20 18 22 16 22 16"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            className="text-accent"
            opacity="0.8"
          />

          <defs>
            <linearGradient id="mark-gradient" x1="4" y1="2" x2="32" y2="35" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(158 55% 35%)" />
              <stop offset="1" stopColor="hsl(158 55% 25%)" />
            </linearGradient>
            <linearGradient id="water-gradient" x1="12" y1="8" x2="24" y2="25" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(190 75% 65%)" />
              <stop offset="1" stopColor="hsl(190 75% 45%)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // Full variant includes text
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex items-center justify-center" style={{ width: iconSize, height: iconSize }}>
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-md"
        >
          {/* Background shield/terrain shape */}
          <path
            d="M18 2L32 8V18C32 28 24 34 18 35C12 34 4 28 4 18V8L18 2Z"
            fill="url(#full-gradient)"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-primary"
          />

          {/* Water drop element */}
          <path
            d="M18 8C18 8 12 15 12 19C12 22.5 14.8 25 18 25C21.2 25 24 22.5 24 19C24 15 18 8 18 8Z"
            fill="url(#full-water-gradient)"
            stroke="currentColor"
            strokeWidth="1"
            className="text-accent"
            opacity="0.9"
          />

          {/* Terrain layers */}
          <path
            d="M10 22L14 20L18 22L22 20L26 22"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-primary-foreground"
            opacity="0.7"
          />
          <path
            d="M8 26L13 24L18 26L23 24L28 26"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-primary-foreground"
            opacity="0.5"
          />

          {/* Absorption wave */}
          <path
            d="M14 16C14 16 16 14 18 16C20 18 22 16 22 16"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            className="text-accent"
            opacity="0.8"
          />

          <defs>
            <linearGradient id="full-gradient" x1="4" y1="2" x2="32" y2="35" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(158 55% 35%)" />
              <stop offset="1" stopColor="hsl(158 55% 25%)" />
            </linearGradient>
            <linearGradient id="full-water-gradient" x1="12" y1="8" x2="24" y2="25" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(190 75% 65%)" />
              <stop offset="1" stopColor="hsl(190 75% 45%)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Text portion - only shown in full variant */}
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight text-foreground">
          {SITE.name}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Urban Resilience
        </div>
      </div>
    </div>
  );
}

/**
 * Compact logo for use in tight spaces like nav items
 */
export function LogoMark({ className }: { className?: string }) {
  return <Logo className={className} variant="mark" size="sm" />;
}