import { useState, useEffect, useRef } from "react";
import { useSensorOptics } from "@/lib/sensor-optics-context";
import { SensorOpticMode, OPTIC_MODES, playTacticalSound } from "@/lib/sensor-optics";
import { PRESETS, type GeocodeResult } from "@/lib/geocode";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  Search,
  Eye,
  MapPin,
  CloudLightning,
  FileText,
  Sliders,
  Terminal,
} from "lucide-react";

interface CommandPaletteProps {
  onSelectCity?: (preset: GeocodeResult & { zoom?: number }) => void;
  onRunSimulation?: () => void;
  onExportPdf?: () => void;
}

export function CommandPalette({
  onSelectCity,
  onRunSimulation,
  onExportPdf,
}: CommandPaletteProps) {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setMode,
    hudOpen,
    setHudOpen,
    soundEnabled,
  } = useSensorOptics();

  const [query, setQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<unknown>(null);

  const handleExecute = (input: string) => {
    const q = input.toLowerCase().trim();
    if (!q) return;

    if (soundEnabled) playTacticalSound("click");

    // Optics commands
    if (q.includes("night vision") || q.includes("nvg")) {
      setMode("NVG");
    } else if (q.includes("flir") || q.includes("thermal")) {
      setMode("FLIR");
    } else if (q.includes("crt")) {
      setMode("CRT");
    } else if (q.includes("noir") || q.includes("monochrome")) {
      setMode("NOIR");
    } else if (q.includes("ir") || q.includes("infrared") || q.includes("vegetation")) {
      setMode("IR");
    } else if (q.includes("normal") || q.includes("rgb") || q.includes("standard")) {
      setMode("NORMAL");
    }
    // HUD command
    else if (q.includes("hud") || q.includes("heads up")) {
      setHudOpen((prev) => !prev);
    }
    // Simulation command
    else if (q.includes("storm") || q.includes("simulation") || q.includes("50mm")) {
      onRunSimulation?.();
    }
    // Export command
    else if (q.includes("export") || q.includes("pdf") || q.includes("dossier")) {
      onExportPdf?.();
    }
    // City jumps
    else {
      const city = PRESETS.find((c) => c.label.toLowerCase().includes(q));
      if (city && onSelectCity) {
        onSelectCity(city);
      }
    }

    setCommandPaletteOpen(false);
    setQuery("");
  };

  const handleExecuteRef = useRef(handleExecute);
  handleExecuteRef.current = handleExecute;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: new () => unknown }).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const rec = new (SpeechRecognition as new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      })();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        setQuery(text);
        setIsListening(false);
        handleExecuteRef.current(text);
      };

      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);

      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    const rec = recognitionRef.current as { start: () => void; stop: () => void };
    if (isListening) {
      rec.stop();
      setIsListening(false);
    } else {
      rec.start();
      setIsListening(true);
      if (soundEnabled) playTacticalSound("click");
    }
  };

  const opticsList: { mode: SensorOpticMode; label: string; desc: string }[] = Object.values(
    OPTIC_MODES
  ).map((c) => ({
    mode: c.id,
    label: c.label,
    desc: c.description,
  }));

  const filteredOptics = opticsList.filter(
    (o) =>
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      o.desc.toLowerCase().includes(query.toLowerCase())
  );

  const filteredCities = PRESETS.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="sm:max-w-xl font-mono p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-xl border border-border shadow-2xl">
        <DialogHeader className="p-3 border-b border-border bg-muted/30 flex flex-row items-center justify-between">
          <DialogTitle className="text-xs uppercase tracking-wider flex items-center gap-2 text-foreground font-semibold">
            <Terminal className="h-4 w-4 text-primary" />
            Spatial Intelligence Command Center
          </DialogTitle>
          <Badge variant="outline" className="text-[10px] font-mono border-border">
            Voice & Terminal
          </Badge>
        </DialogHeader>

        <div className="p-3 border-b border-border flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleExecute(query);
              }
            }}
            placeholder="Type command or speak (e.g., 'Switch to NVG', 'Fly to Copenhagen', 'Run 50mm storm')..."
            className="h-9 font-mono text-xs bg-transparent border-none focus-visible:ring-0 shadow-none px-0"
            autoFocus
          />
          <Button
            variant={isListening ? "destructive" : "outline"}
            size="icon"
            onClick={toggleListening}
            className="h-8 w-8 shrink-0 relative"
            title={isListening ? "Listening... click to stop" : "Start voice recognition"}
          >
            {isListening ? (
              <MicOff className="h-4 w-4 animate-pulse" />
            ) : (
              <Mic className="h-4 w-4 text-primary" />
            )}
          </Button>
        </div>

        <div className="max-h-[340px] overflow-y-auto p-2 space-y-3 text-xs">
          {/* Action Quick Items */}
          <div className="space-y-1">
            <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Quick Actions
            </div>

            <button
              onClick={() => {
                setHudOpen((v) => !v);
                setCommandPaletteOpen(false);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-muted/60 flex items-center justify-between text-foreground transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                <span>{hudOpen ? "Close GEOINT HUD Overlay" : "Open GEOINT HUD Overlay"}</span>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono">Hotkey [H]</Badge>
            </button>

            {onRunSimulation && (
              <button
                onClick={() => {
                  onRunSimulation();
                  setCommandPaletteOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-muted/60 flex items-center justify-between text-foreground transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CloudLightning className="h-3.5 w-3.5 text-amber-400" />
                  <span>Execute 50mm Design Storm Hydrograph Simulation</span>
                </div>
                <Badge variant="secondary" className="text-[10px] font-mono">Simulate</Badge>
              </button>
            )}

            {onExportPdf && (
              <button
                onClick={() => {
                  onExportPdf();
                  setCommandPaletteOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-muted/60 flex items-center justify-between text-foreground transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                  <span>Generate Publication PDF Resilience Dossier</span>
                </div>
                <Badge variant="secondary" className="text-[10px] font-mono">Export PDF</Badge>
              </button>
            )}
          </div>

          {/* Sensor Optics Modes */}
          {filteredOptics.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Sensor Optic Reskin Lenses [1-6]
              </div>
              {filteredOptics.map((opt) => (
                <button
                  key={opt.mode}
                  onClick={() => {
                    setMode(opt.mode);
                    setCommandPaletteOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-muted/60 flex items-center justify-between text-foreground transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{opt.label}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Location Presets */}
          {filteredCities.length > 0 && onSelectCity && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Global Watershed Bookmarks
              </div>
              {filteredCities.map((city) => (
                <button
                  key={city.label}
                  onClick={() => {
                    onSelectCity(city);
                    setCommandPaletteOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-muted/60 flex items-center justify-between text-foreground transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-rose-400" />
                    <span>{city.label}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    [{city.lat.toFixed(3)}°, {city.lng.toFixed(3)}°]
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
