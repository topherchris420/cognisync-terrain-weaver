import { Link, NavLink } from "react-router-dom";
import { Layers, Map as MapIcon, LineChart, Github } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { SITE } from "@/lib/site";

const links = [
  { to: "/", label: "Overview", icon: Layers, end: true },
  { to: "/analyze", label: "Analyze", icon: MapIcon },
  { to: "/dashboard", label: "Dashboard", icon: LineChart },
];

// Routes are lazy-loaded (Analyze alone pulls ~800 kB of MapLibre), so start
// fetching the chunk on hover/focus instead of after the click. Vite dedupes
// these against the lazy() imports in App.tsx — same module, same chunk.
const PREFETCH: Record<string, () => void> = {
  "/analyze": () => void import("@/pages/Analyze"),
  "/dashboard": () => void import("@/pages/Dashboard"),
};

export function AppNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      {/* Keyboard users get a shortcut past the nav; invisible until focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <Logo size="md" />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onPointerEnter={PREFETCH[to]}
              onFocus={PREFETCH[to]}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={SITE.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Open source repository"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden border-t border-border/60 flex">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
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
