import { Link } from "react-router-dom";
import {
  ArrowRight,
  Satellite,
  Sprout,
  Droplets,
  Cpu,
  GaugeCircle,
  Github,
  Globe2,
  MousePointerClick,
  PencilRuler,
  ScanSearch,
  ClipboardList,
  CheckCircle2,
  SlidersHorizontal,
  FileJson,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/AppNav";
import { Reveal } from "@/components/Reveal";
import { SITE } from "@/lib/site";

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
    icon: SlidersHorizontal,
    title: "Scenario Studio",
    body: "Drag intervention sliders — depaving, bioswales, permeable pavement, green roofs — and watch the score, retention volume, cost, and payback update live.",
  },
  {
    icon: FileJson,
    title: "GIS-native export",
    body: "GeoJSON footprint polygons, CSV attribute tables, and PDF reports that slot straight into QGIS, ArcGIS, PostGIS, or your BI stack.",
  },
  {
    icon: Cpu,
    title: "Modular by design",
    body: "Ready to plug in hydrological simulations, IoT sensor streams, and city-scale digital twin layers.",
  },
];

const steps = [
  {
    icon: MousePointerClick,
    step: "01",
    title: "Frame a location",
    body: "Pan and zoom the live satellite map to any neighborhood, watershed, or district on Earth.",
  },
  {
    icon: ScanSearch,
    step: "02",
    title: "Classify the surface",
    body: "The visible tile is captured and a vision model breaks it into five land-cover classes.",
  },
  {
    icon: ClipboardList,
    step: "03",
    title: "Score & act",
    body: "Get an absorption score, a flood-risk band, and a prioritized adaptation playbook you can export.",
  },
];

const weights = [
  { label: "Vegetation", weight: 1.0, note: "Highest infiltration & cooling", cls: "bg-surface-vegetation" },
  { label: "Bare soil", weight: 0.85, note: "Permeable, variable", cls: "bg-surface-soil" },
  { label: "Water", weight: 0.5, note: "Existing hydro capacity", cls: "bg-surface-water" },
  { label: "Buildings", weight: 0.05, note: "Effectively impervious", cls: "bg-surface-building" },
  { label: "Pavement", weight: 0.05, note: "Effectively impervious", cls: "bg-surface-pavement" },
];

const personas = [
  {
    icon: PencilRuler,
    eyebrow: "For urban planners",
    title: "Model the intervention before the ribbon cutting",
    points: [
      "Scenario Studio — drag depaving, bioswale, permeable-pavement, and green-roof sliders over any analyzed block",
      "Watch the absorption score, flood-risk band, and retained stormwater respond in real time",
      "Every configured scenario lands in the PDF report, ready for the council packet",
    ],
  },
  {
    icon: Globe2,
    eyebrow: "For GIS professionals",
    title: "Open formats, zero lock-in",
    points: [
      "One-click GeoJSON export with true footprint polygons in WGS84",
      "CSV attribute tables for joins in QGIS, ArcGIS, PostGIS, or a spreadsheet",
      "Deep links restore any map view; the scoring weights are open source",
    ],
  },
  {
    icon: TrendingUp,
    eyebrow: "For investors & finance",
    title: "Underwrite resilience with numbers",
    points: [
      "Capital cost, annual benefit, and simple payback for every scenario",
      "Portfolio view: score distribution, risk mix, and site-vs-site comparison",
      "Transparent assumptions you can calibrate to your market before underwriting",
    ],
  },
];

const riskBands = [
  { range: "65 – 100", label: "Low", desc: "Resilient", cls: "border-primary/30 bg-primary/10 text-primary" },
  { range: "40 – 64", label: "Moderate", desc: "Vulnerable", cls: "border-warning/30 bg-warning/10 text-warning" },
  { range: "0 – 39", label: "High", desc: "Critical", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
];

export default function Index() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-glow" aria-hidden />
        <div className="absolute inset-0 terrain-grid terrain-grid-animated opacity-40" aria-hidden />
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
            {SITE.name} analyzes satellite imagery and GIS data to estimate
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
          <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { k: "5", l: "land-cover classes" },
              { k: "0–100", l: "absorption score" },
              { k: "4", l: "what-if interventions" },
              { k: "3", l: "open export formats" },
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

      {/* How it works */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            From satellite tile to action plan
          </h2>
          <p className="mt-3 text-muted-foreground">
            Three steps, no GIS expertise required — go from a map view to a
            defensible resilience report in under a minute.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, step, title, body }, i) => (
            <Reveal
              key={title}
              delay={i * 90}
              className="panel relative rounded-xl border border-border p-6"
            >
              <span className="absolute right-5 top-5 font-mono text-xs font-semibold text-muted-foreground/60">
                {step}
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15 text-accent">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-6 pt-14">
        <div className="grid gap-4 md:grid-cols-2">
          {features.map(({ icon: Icon, title, body }, i) => (
            <Reveal
              key={title}
              delay={(i % 2) * 80}
              className="panel h-full rounded-xl border border-border p-6 transition-colors hover:border-primary/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Personas */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-6 pt-14">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Built for the people shaping cities
          </h2>
          <p className="mt-3 text-muted-foreground">
            One shared evidence base — whether you're drawing the plan, running
            the spatial analysis, or writing the check.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {personas.map(({ icon: Icon, eyebrow, title, points }, i) => (
            <Reveal
              key={eyebrow}
              delay={i * 90}
              className="panel flex h-full flex-col rounded-xl border border-border p-6 transition-colors hover:border-accent/40"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/15 text-accent">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest text-accent">
                  {eyebrow}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <ul className="mt-3 space-y-2.5">
                {points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Methodology — the Urban Absorption Score */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-6 pt-14">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <GaugeCircle className="h-3.5 w-3.5" />
              The methodology
            </div>
            <h2 className="mt-4 text-2xl md:text-3xl font-bold tracking-tight">
              A transparent absorption score
            </h2>
            <p className="mt-3 text-muted-foreground">
              Every scan produces one 0–100 number, derived from land-cover
              percentages weighted by simplified runoff coefficients from urban
              hydrology. No black box — the weights are open and calibratable.
            </p>

            <div className="mt-6 space-y-2.5">
              {weights.map((w) => (
                <div
                  key={w.label}
                  className="flex items-center gap-3 rounded-lg border border-border panel px-3 py-2.5"
                >
                  <span className={`h-3 w-3 shrink-0 rounded-md ${w.cls}`} />
                  <span className="w-24 text-sm font-medium">{w.label}</span>
                  <span className="font-mono text-sm font-semibold text-primary">
                    {w.weight.toFixed(2)}
                  </span>
                  <span className="ml-auto text-right text-xs text-muted-foreground">
                    {w.note}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="panel rounded-xl border border-border p-6">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Flood-risk banding
              </h3>
              <div className="mt-4 space-y-3">
                {riskBands.map((b) => (
                  <div
                    key={b.label}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-4"
                  >
                    <div>
                      <div className="font-mono text-lg font-semibold">
                        {b.range}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {b.desc}
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${b.cls}`}
                    >
                      {b.label} risk
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Weights are intentionally simple and transparent. Fork the
                project to calibrate them against local runoff data for your
                climate zone.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Roadmap */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-6 pt-14">
        <Reveal className="rounded-xl border border-border panel p-6 md:p-8">
          <div className="flex items-start gap-3">
            <Droplets className="h-5 w-5 text-accent" />
            <div>
              <h3 className="text-lg font-semibold">Where this is heading</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Today: land-cover classification, absorption scoring,
                what-if scenario modeling with investment analytics, and
                GIS-native export. Next up: hydrological simulation of runoff
                paths, live IoT sensor ingestion (rain gauges, soil moisture),
                and a block-level digital-twin view exposed via a documented
                API.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {[
                  { v: "v0.1 — Land cover · Absorption score", current: false },
                  { v: "v0.2 — Scenario studio · ROI · GIS export", current: true },
                  { v: "v0.3 — Runoff sim · IoT sensor fusion", current: false },
                  { v: "v1.0 — Digital twin & API", current: false },
                ].map(({ v, current }) => (
                  <span
                    key={v}
                    className={
                      current
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
        </Reveal>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24 pt-14">
        <Reveal className="relative overflow-hidden rounded-2xl border border-primary/25 panel p-8 text-center md:p-12">
          <div className="absolute inset-0 hero-glow opacity-70" aria-hidden />
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Ready to measure your city's resilience?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Free, open-source, and no account required. Run your first scan in
              seconds and export a shareable PDF report.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="glow-primary">
                <Link to="/analyze">
                  Start analyzing
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={SITE.repoUrl} target="_blank" rel="noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  Star on GitHub
                </a>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="mt-auto border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} {SITE.name} · Open Urban Resilience</span>
          <nav className="flex items-center gap-5">
            <Link to="/analyze" className="hover:text-foreground transition-colors">
              Analyze
            </Link>
            <Link to="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              Source
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
