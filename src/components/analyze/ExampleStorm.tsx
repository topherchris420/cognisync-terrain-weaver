import { useState } from "react";
import { CloudRain } from "lucide-react";
import { estimateRunoffVolumeM3 } from "@/lib/simulation";
import { bboxAreaKm2, type BBox } from "@/lib/geo";
import type { LandCover } from "@/lib/types";

export function ExampleStorm({ cover, bbox }: { cover: LandCover; bbox: BBox }) {
  const [rainfall, setRainfall] = useState(50);
  const runoff = estimateRunoffVolumeM3(cover, rainfall, bbox);
  const rainVolume = bboxAreaKm2(bbox) * 1e6 * rainfall / 1000;
  return (
    <section className="atlas-rainfall" aria-labelledby="example-storm-title">
      <CloudRain className="mb-4 text-primary" size={28} aria-hidden="true" />
      <span className="atlas-eyebrow">Try a different storm</span>
      <h3 id="example-storm-title" className="mb-2 text-xl font-medium">Where does the rain go?</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">Change the rainfall depth to explore how much water this illustrative surface could shed.</p>
      <div className="my-7">
        <label htmlFor="example-rainfall" className="mb-3 flex items-baseline justify-between text-sm">Rainfall depth <span className="font-mono text-2xl text-foreground">{rainfall} <span className="text-xs text-muted-foreground">mm</span></span></label>
        <input id="example-rainfall" type="range" min={10} max={150} step={5} value={rainfall} onChange={(event) => setRainfall(Number(event.target.value))} className="w-full accent-[hsl(var(--primary))]" />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground"><span>10 mm</span><span>150 mm</span></div>
      </div>
      <div className="grid grid-cols-2 gap-4 border-y border-border py-5" aria-live="polite">
        <div><span className="atlas-eyebrow">Rainfall volume</span><p className="font-mono text-xl">{Math.round(rainVolume).toLocaleString()} <span className="text-xs">m³</span></p></div>
        <div><span className="atlas-eyebrow">Estimated runoff</span><p className="font-mono text-xl text-primary" data-testid="example-runoff">{Math.round(runoff).toLocaleString()} <span className="text-xs">m³</span></p></div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Local estimate: rainfall × area × weighted runoff coefficient. Uses illustrative land cover and the app’s coefficient model. No elevation routing, drainage, flood depths, or live simulation.</p>
    </section>
  );
}
