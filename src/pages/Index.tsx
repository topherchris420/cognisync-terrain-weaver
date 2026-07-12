import { Link } from "react-router-dom";
import { ArrowRight, Satellite, Sprout, Droplets, Cpu, GaugeCircle, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/AppNav";

const features = [
  {
    icon: Satellite,
    title: "Satellite land-cover analysis",
    body: "Point at any city. We segment the tile into pavement, buildings, vegetation, water, and bare soil using a vision LLM.",
  },
  {
    icon: GaugeCircle,
    title: "Urban Absorption Score",
    body: "A single 0–100 metric that fuses surface permeability into a stormwater-absorption rating with flood-risk banding.",
  },
  {
    icon: Sprout,
    title: "Adaptation playbook",
    body: "AI-generated green / blue / gray interventions prioritized for the site's specific composition and vulnerabilities.",
  },
  {
    icon: Cpu,
    title: "Modular by design",
    body: "Ready to plug in hydrological simulations, IoT sensor streams, and city-scale digital twin layers.",
  },
];

export default function Index() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-glow" aria-hidden />
        <div className="absolute inset-0 terrain-grid opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-6 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft" />
            Open-source · Urban Resilience Intelligence
          </div>

          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight">
            See how much water your city{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              can actually absorb.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Vers3Dynamics analyzes satellite imagery and GIS data to estimate
            urban permeability, quantify flood vulnerability, and surface
            climate-adaptation strategies you can act on.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="glow-primary">
              <Link to="/analyze">
                Analyze a location
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dashboard">Browse public analyses</Link>
            </Button>
          </div>

          {/* Metric strip */}
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-4">
            {[
              { k: "5", l: "land-cover classes" },
              { k: "0–100", l: "absorption score" },
              { k: "3 tiers", l: "flood risk banding" },
            ].map((m) => (
              <div
                key={m.l}
                className="panel rounded-lg border border-border p-4"
              >
                <div className="font-mono text-2xl font-semibold text-primary">
                  {m.k}
                </div>
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                  {m.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="panel rounded-xl border border-border p-6 transition-colors hover:border-primary/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        {/* Roadmap */}
        <div className="mt-12 rounded-xl border border-border panel p-6 md:p-8">
          <div className="flex items-start gap-3">
            <Droplets className="h-5 w-5 text-accent" />
            <div>
              <h3 className="text-lg font-semibold">Where this is heading</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Today: satellite-tile land-cover classification and absorption
                scoring. Next up: hydrological simulation of runoff paths, live
                IoT sensor ingestion (rain gauges, soil moisture), and a
                block-level digital-twin view exposed via a documented API.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {[
                  "v0.1 — Land cover · Absorption score",
                  "v0.2 — Hydrological runoff sim",
                  "v0.3 — IoT sensor fusion",
                  "v1.0 — Digital twin & API",
                ].map((v, i) => (
                  <span
                    key={v}
                    className={
                      i === 0
                        ? "rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-primary"
                        : "rounded-full border border-border px-2.5 py-1 text-muted-foreground"
                    }
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-border/60 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-xs text-muted-foreground">
          <span>© Vers3Dynamics · Open Urban Resilience</span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            Source
          </a>
        </div>
      </footer>
    </div>
  );
}
