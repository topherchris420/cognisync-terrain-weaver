import { useSensorOptics } from "@/lib/sensor-optics-context";
import { OPTIC_MODES, SensorOpticMode } from "@/lib/sensor-optics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Terminal, Sliders } from "lucide-react";

export function NavOpticsControls() {
  const {
    opticConfig,
    setMode,
    hudOpen,
    setHudOpen,
    setCommandPaletteOpen,
  } = useSensorOptics();

  return (
    <div className="flex items-center gap-1.5">
      {/* Optic Mode Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 font-mono text-xs border-border/80 bg-muted/20"
          >
            <Eye className="h-3.5 w-3.5" style={{ color: opticConfig.accentColor }} />
            <span className="hidden sm:inline">{opticConfig.label}</span>
            <Badge
              variant="secondary"
              className="text-[10px] font-mono px-1 py-0 h-4"
              style={{ color: opticConfig.accentColor }}
            >
              {opticConfig.id}
            </Badge>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 font-mono text-xs">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Sensor Optic Lenses [Keys 1-6]
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(OPTIC_MODES) as SensorOpticMode[]).map((m) => {
            const conf = OPTIC_MODES[m];
            return (
              <DropdownMenuItem
                key={m}
                onClick={() => setMode(m)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full inline-block"
                    style={{ backgroundColor: conf.accentColor }}
                  />
                  <span>{conf.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-bold">
                  [{conf.shortcut}]
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* GEOINT HUD Toggle Button */}
      <Button
        variant={hudOpen ? "default" : "outline"}
        size="sm"
        onClick={() => setHudOpen((v) => !v)}
        className="h-8 gap-1 font-mono text-xs border-border/80"
        title="Toggle GEOINT HUD Overlay (Hotkey H)"
      >
        <Sliders className="h-3.5 w-3.5" />
        <span className="hidden md:inline">HUD</span>
      </Button>

      {/* Command Palette Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setCommandPaletteOpen((v) => !v)}
        className="h-8 gap-1 font-mono text-xs border-border/80"
        title="Open Command Palette (⌘K)"
      >
        <Terminal className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">⌘K</span>
      </Button>
    </div>
  );
}
