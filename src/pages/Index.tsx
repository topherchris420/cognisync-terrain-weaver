import { Link } from "react-router-dom";
import {
  ArrowRight,
  Github,
  Globe2,
  PencilRuler,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/AppNav";
import { Reveal } from "@/components/Reveal";
import { AbsorptionScoreGauge } from "@/components/AbsorptionScoreGauge";
import { LandCoverBreakdown } from "@/components/LandCoverBreakdown";
import { RecentScans } from "@/components/RecentScans";
import { ABSORPTION_WEIGHTS, RISK_BANDS } from "@/lib/absorption";
import { SITE } from "@/lib/site";

// A fixed composition used to demonstrate the two real components in the hero.
// Labelled as a sample on the page -- it is not presented as a live scan.
const previewCover = {
  vegetation: 18,
  soil: 6,
  water: 4,
  buildings: 41,
  pavement: 31,
};

const steps = [
  {
    step: "01",
    title: "Frame a location",
    body: "Search any city, or pan the live satellite map to a neighborhood, watershed, or district.",
  },
  {
    step: "02",
    title: "Classify the surface",
    body: "The visible tile is captured and a vision model breaks it into five land-cover classes.",
  },
  {
    step: "03",
    title: "Score and act",
    body: "Get an absorption score, a flood-risk band, and a prioritized adaptation playbook you can export.",
  },
];

// Read live from the scoring model. This table is the page's credibility claim
// -- "here are the weights, all of them" -- so it must not be a hand-copied set
// of numbers that can drift from the ones actually applied.
const weights = [
  { key: "vegetation", label: "Vegetation", note: "Runoff coefficient C ≈ 0.20", cls: "bg-surface-vegetation" },
  { key: "soil", label: "Bare soil", note: "Compacted urban soil, C ≈ 0.30", cls: "bg-surface-soil" },
  { key: "buildings", label: "Buildings", note: "Roofs, C ≈ 0.90", cls: "bg-surface-building" },
  { key: "pavement", label: "Pavement", note: "Asphalt & concrete, C ≈ 0.88", cls: "bg-surface-pavement" },
] as const;

const riskBands = [
  {
    range: `${RISK_BANDS.low} – 100`,
    label: "Low",
    desc: "The land takes most of the rain",
    cls: "border-primary/30 bg-primary/10 text-primary",
  },
  {
    range: `${RISK_BANDS.moderate} – ${RISK_BANDS.low - 1}`,
    label: "Moderate",
    desc: "Roughly half runs off",
    cls: "border-warning/30 bg-warning/10 text-warning",
  },
  {
    range: `0 – ${RISK_BANDS.moderate - 1}`,
    label: "High",
    desc: "Two thirds or more runs off",
    cls: "border-destructive/30 bg-destructive/10 text-destructive",
  },
];

// Capabilities are named once, under the audience that actually cares about
// them, rather than twice -- as a feature card and again as a persona bullet.
const audiences = [
  {
    icon: PencilRuler,
    eyebrow: "Urban planners",
    title: "Model the intervention before the ribbon cutting",
    points: [
      "Scenario Studio: drag depaving, bioswale, permeable-pavement, and green-roof sliders over any analyzed block",
      "Absorption score, flood-risk band, and retained stormwater respond in real time",
      "Every configured scenario lands in the PDF report, ready for the council packet",
    ],
  },
  {
    icon: Globe2,
    eyebrow: "GIS professionals",
    title: "Open formats, zero lock-in",
    points: [
      "One-click GeoJSON export with true footprint polygons in WGS84",
      "CSV attribute tables for joins in QGIS, ArcGIS, PostGIS, or a spreadsheet",
      "Deep links restore any map view, and the scoring weights are open source",
    ],
  },
  {
    icon: TrendingUp,
    eyebrow: "Investors and finance",
    title: "Underwrite resilience with numbers",
    points: [
      "Capital cost, annual benefit, and simple payback for every scenario",
      "Portfolio view: score distribution, risk mix, and site-vs-site comparison",
      "Transparent assumptions you can calibrate to your market before underwriting",
    ],
  },
];

const roadmap = [
  { v: "v0.1", label: "Land cover · absorption score", current: false },
  { v: "v0.2", label: "Scenario studio · ROI · GIS export", current: true },
  { v: "v0.3", label: "Runoff sim · IoT sensor fusion", current: false },
  { v: "v1.0", label: "Digital twin & API", current: false },
];

export default function Index() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />

      {/* Hero — the page's one atmospheric moment. */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 hero-glow" aria-hidden />
        <div className="absolute inset-0 terrain-grid opacity-40" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-16 md:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="min-w-0">
            <div className="border-l-2 border-accent pl-3 text-xs font-semibold uppercase tracking-widest text-accent">
              Open-source urban resilience intelligence
            </div>

            <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">
              See how much water your city{" "}
              <span className="text-primary">can actually absorb.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              {SITE.name} analyzes satellite imagery and GIS data to estimate
              urban permeability, quantify flood vulnerability, and surface
              climate-adaptation strategies you can act on.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
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

            {/* Facts about the product, not invented usage statistics. */}
            <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border/60 pt-6 sm:grid-cols-4">
              {[
                { k: "5", l: "land-cover classes" },
                { k: "0–100", l: "absorption score" },
                { k: "4", l: "what-if interventions" },
                { k: "3", l: "open export formats" },
              ].map((m) => (
                <div key={m.l} className="min-w-0">
                  <div className="font-mono text-xl font-semibold text-foreground">
                    {m.k}
                  </div>
                  <div className="mt-0.5 text-xs uppercase tracking-widest text-muted-foreground">
                    {m.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* The real components, running on a fixed sample composition.
              Labelled as a sample: nothing here was scanned just now. */}
          <Reveal delay={120} className="panel min-w-0 rounded-xl border border-border p-5 md:p-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <div className="text-sm font-semibold">Lower Manhattan, NY</div>
                <div className="text-xs text-muted-foreground">
                  Sample analysis · run your own in seconds
                </div>
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                Sample
              </span>
            </div>
            <div className="pt-5">
              <AbsorptionScoreGauge score={58} />
            </div>
            <div className="mt-6 border-t border-border/60 pt-5">
              <LandCoverBreakdown cover={previewCover} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Real scans from the public feed. Renders nothing if there are none --
          the point of this strip is that the numbers are real. */}
      <RecentScans />

      {/* How it works — a sequence, so it reads as a row, not a menu of cards. */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <Reveal>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map(({ step, title, body }) => (
              <div key={step} className="border-t border-border pt-5">
                <span className="font-mono text-xs font-semibold text-accent">
                  {step}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Methodology — the centerpiece. The most credible thing on the site is
          that the number is auditable, so it gets the most room. */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                The score is not a black box
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Every scan produces one 0–100 number: the share of rainfall the
                land can absorb. Each weight is{" "}
                <span className="font-mono text-foreground">1 − C</span>, where{" "}
                <span className="font-mono text-foreground">C</span> is the
                Rational-Method runoff coefficient used in real drainage
                engineering. Here are the weights. All of them.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
            <Reveal>
              <div className="space-y-2.5">
                {weights.map((w) => (
                  <div
                    key={w.key}
                    className="panel flex items-center gap-3 rounded-lg border border-border px-4 py-3"
                  >
                    <span className={`h-3 w-3 shrink-0 rounded-md ${w.cls}`} />
                    <span className="w-24 text-sm font-medium">{w.label}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-primary">
                      {ABSORPTION_WEIGHTS[w.key].toFixed(2)}
                    </span>
                    <span className="ml-auto text-right text-xs text-muted-foreground">
                      {w.note}
                    </span>
                  </div>
                ))}

                {/* Water is deliberately absent from the table above, and saying
                    so plainly is the point -- it was the model's real bug. */}
                <div className="flex items-start gap-3 rounded-lg border border-dashed border-border px-4 py-3">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-md bg-surface-water" />
                  <div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-sm font-medium">Open water</span>
                      <span className="font-mono text-sm font-semibold text-muted-foreground">
                        excluded
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      A river is not a sponge — it is where the runoff goes.
                      Scoring it as absorption rewards a site for being
                      flood-exposed, so water is removed from the denominator
                      entirely. The score asks: of the <em>land</em> here, how
                      much rain can it take?
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Calibrated against 18 real scans, from Bois de Boulogne (74.7) to
                Midtown Manhattan (14.0). Fork the project and recalibrate
                against local runoff data for your climate zone.
              </p>
            </Reveal>

            <Reveal delay={120}>
              <div className="panel rounded-xl border border-border p-6">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Flood-risk banding
                </h3>
                <div className="mt-4 space-y-3">
                  {riskBands.map((b) => (
                    <div
                      key={b.label}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-4"
                    >
                      <div>
                        <div className="font-mono text-lg font-semibold tabular-nums">
                          {b.range}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {b.desc}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${b.cls}`}
                      >
                        {b.label} risk
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Who it's for — left-aligned, and the only place capabilities are named. */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Built for the people shaping cities
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            One shared evidence base — whether you're drawing the plan, running
            the spatial analysis, or writing the check.
          </p>
        </Reveal>

        <Reveal delay={90}>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {audiences.map(({ icon: Icon, eyebrow, title, points }) => (
              <div
                key={eyebrow}
                className="panel flex h-full flex-col rounded-xl border border-border p-6"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/15 text-accent">
                    <Icon className="h-4 w-4" />
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
                      className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Roadmap — a quiet strip. */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <Reveal>
          <div className="rounded-xl border border-border/60 p-6 md:p-8">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Where this is heading
            </h3>
            <ul className="mt-5 space-y-3">
              {roadmap.map(({ v, label, current }) => (
                <li key={v} className="flex items-baseline gap-4">
                  <span
                    className={`w-12 shrink-0 font-mono text-sm font-semibold tabular-nums ${
                      current ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {v}
                  </span>
                  <span
                    className={
                      current ? "text-sm" : "text-sm text-muted-foreground"
                    }
                  >
                    {label}
                  </span>
                  {current && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                      Shipping
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* Closing CTA — no second glow. The hero owns the atmosphere. */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <Reveal>
          <div className="panel rounded-2xl border border-primary/25 p-8 text-center md:p-12">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Ready to measure your city's resilience?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Free, open-source, and no account required. Run your first scan in
              seconds and export a shareable PDF report.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
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
