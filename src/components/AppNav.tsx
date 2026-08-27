import { Link, NavLink } from "react-router-dom";
import { Layers, Map as MapIcon, LineChart, Github, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { SITE } from "@/lib/site";
import { NavOpticsControls } from "./tactical/NavOpticsControls";

const links = [
  { to: "/", label: "Map", icon: MapIcon, end: true },
  { to: "/tactical", label: "Tactical COP", icon: Radio },
  { to: "/dashboard", label: "Dashboard", icon: LineChart },
];

// Routes are lazy-loaded (Analyze alone pulls ~800 kB of MapLibre), so start
// fetching the chunk on hover/focus instead of after the click. Vite dedupes
// these against the lazy() imports in App.tsx — same module, same chunk.
const PREFETCH: Record<string, () => void> = {
  "/": () => void import("@/pages/Analyze"),
  "/tactical": () => void import("@/pages/Tactical"),
  "/dashboard": () => void import("@/pages/Dashboard"),
};

export function AppNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
      {/* Keyboard users get a shortcut past the nav; invisible until focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="flex h-11 items-center justify-between pl-3 pr-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <Logo size="sm" variant="mark" />
            <span className="hud-value text-[11px] font-semibold uppercase tracking-[0.28em] text-foreground">
              Mannahatta
            </span>
          </Link>

          <span className="hidden md:block h-5 w-px bg-border" />

          <div className="hidden md:flex items-center gap-2">
            <span className="signal-dot" aria-hidden />
            <span className="hud-label">Live · Urban Resilience Intelligence</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-0 border-x border-border">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onPointerEnter={PREFETCH[to]}
              onFocus={PREFETCH[to]}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-1.5 border-r border-border px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors last:border-r-0",
                  isActive
                    ? "bg-primary/10 text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <NavOpticsControls />
          <a
            href={SITE.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
            aria-label="Open source repository"
          >
            <Github className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden border-t border-border flex">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex-1 flex items-center justify-center gap-1.5 border-r border-border py-2 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors last:border-r-0",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

