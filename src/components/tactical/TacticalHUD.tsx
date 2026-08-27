import { useState, useEffect } from "react";
import { useSensorOptics } from "@/lib/sensor-optics-context";
import { latLngToMaidenhead } from "@/lib/sensor-optics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Crosshair,
  Volume2,
  VolumeX,
  Eye,
  Terminal,
  X,
  Compass,
  Layers,
  Activity,
} from "lucide-react";

interface TacticalHUDProps {
  lat?: number;
  lng?: number;
  zoom?: number;
  bearing?: number;
  pitch?: number;
  surfaceAreaKm2?: number;
  absorptionScore?: number;
  compositeRunoffC?: number;
  locationName?: string;
}

export function TacticalHUD({
  lat = 40.758,
  lng = -73.985,
  zoom = 15,
  bearing = 0,
  pitch = 0,
  surfaceAreaKm2 = 1.25,
  absorptionScore = 58.4,
  compositeRunoffC = 0.42,
  locationName = "Sector 01 — Mannahatta Catchment",
}: TacticalHUDProps) {
  const {
    hudOpen,
    setHudOpen,
    opticConfig,
    cycleMode,
    soundEnabled,
    setSoundEnabled,
    setCommandPaletteOpen,
    detectionOpen,
    setDetectionOpen,
  } = useSensorOptics();

  const [timeUtc, setTimeUtc] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeUtc(d.toISOString().substring(11, 19) + " Z");
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!hudOpen) return null;

  const maidenhead = latLngToMaidenhead(lat, lng);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 flex flex-col justify-between p-4 md:p-6 select-none font-mono text-xs overflow-hidden">
      {/* Corner Bracket Graphics */}
      <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 pointer-events-none opacity-80" style={{ borderColor: opticConfig.accentColor }} />
      <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 pointer-events-none opacity-80" style={{ borderColor: opticConfig.accentColor }} />
      <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 pointer-events-none opacity-80" style={{ borderColor: opticConfig.accentColor }} />
      <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 pointer-events-none opacity-80" style={{ borderColor: opticConfig.accentColor }} />

      {/* Center Target Lock Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
        <div className="relative flex items-center justify-center">
          <div className="w-24 h-24 rounded-full border border-dashed animate-spin-slow" style={{ borderColor: opticConfig.accentColor }} />
          <Crosshair className="absolute w-8 h-8" style={{ color: opticConfig.accentColor }} />
          <div className="absolute top-14 text-[10px] tracking-widest whitespace-nowrap font-bold" style={{ color: opticConfig.accentColor }}>
            TGT [{lat.toFixed(5)}°, {lng.toFixed(5)}°]
          </div>
        </div>
      </div>

      {/* Top Telemetry & Controls Bar */}
      <div className="pointer-events-auto flex items-start justify-between gap-4 z-10 bg-background/80 backdrop-blur-md p-3 rounded-lg border border-border/80 shadow-2xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full animate-ping inline-block" style={{ backgroundColor: opticConfig.accentColor }} />
            <span className="font-bold text-sm tracking-wider uppercase text-foreground">
              GEOINT HUD :: {opticConfig.badge}
            </span>
            <Badge variant="outline" className="font-mono text-[10px] border-border text-muted-foreground">
              GRID: {maidenhead}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">{locationName}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={cycleMode}
            className="h-8 gap-1.5 font-mono text-xs border-border"
          >
            <Eye className="h-3.5 w-3.5" style={{ color: opticConfig.accentColor }} />
            Optics [{opticConfig.shortcut}]
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetectionOpen((v) => !v)}
            className="h-8 gap-1.5 font-mono text-xs border-border hidden sm:flex"
          >
            <Layers className="h-3.5 w-3.5" />
            Targets [{detectionOpen ? "ON" : "OFF"}]
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommandPaletteOpen((v) => !v)}
            className="h-8 gap-1.5 font-mono text-xs border-border"
          >
            <Terminal className="h-3.5 w-3.5" />
            CMD [⌘K]
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled((v) => !v)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title={soundEnabled ? "Mute tactical audio" : "Enable tactical audio"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHudOpen(false)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bottom Telemetry Bar */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-4 z-10 bg-background/80 backdrop-blur-md p-3 rounded-lg border border-border/80 shadow-2xl">
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-primary" />
            <span>LAT: <strong className="text-foreground">{lat.toFixed(5)}°</strong></span>
            <span>LNG: <strong className="text-foreground">{lng.toFixed(5)}°</strong></span>
          </div>

          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span>ZOOM: <strong className="text-foreground">{zoom.toFixed(1)}</strong></span>
            <span>BEARING: <strong className="text-foreground">{bearing.toFixed(0)}°</strong></span>
            <span>PITCH: <strong className="text-foreground">{pitch.toFixed(0)}°</strong></span>
          </div>

          <div className="hidden lg:flex items-center gap-3 border-l border-border pl-3">
            <span>AREA: <strong className="text-foreground">{surfaceAreaKm2.toFixed(2)} km²</strong></span>
            <span>RUNOFF C: <strong className="text-foreground">{compositeRunoffC.toFixed(2)}</strong></span>
            <span>ABSORPTION: <strong className="text-emerald-400">{absorptionScore.toFixed(1)}/100</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-bold tracking-wider" style={{ color: opticConfig.accentColor }}>
          <span>SYS OK</span>
          <span className="text-muted-foreground font-normal">|</span>
          <span>{timeUtc}</span>
        </div>
      </div>
    </div>
  );
}
