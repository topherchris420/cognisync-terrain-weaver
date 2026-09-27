import { Link } from "react-router-dom";
import { AppNav } from "@/components/AppNav";

/** Retired demo route: never turn arbitrary coordinates into invented hazards. */
export default function TacticalPage() {
  return (
    <div className="atlas-app min-h-screen bg-background">
      <AppNav />
      <main id="main" className="mx-auto max-w-2xl px-6 py-16 space-y-6">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          Mannahatta / model boundaries
        </p>
        <h1 className="text-3xl font-semibold">
          Start with a study, not an emergency map.
        </h1>
        <p>
          The former Tactical demonstration generated synthetic flow paths,
          hazard zones and operational telemetry. It has been retired from the
          public workflow.
        </p>
        <p className="text-muted-foreground">
          No completed simulation is loaded here. Coordinates in a link are not
          evidence of flooding, safe routes or available supplies. Mannahatta
          provides screening experiments, not an emergency operating picture.
        </p>
        <Link
          className="inline-flex min-h-11 items-center border border-primary px-5 text-primary"
          to="/"
        >
          Open the resilience workstation
        </Link>
        <p className="text-sm text-muted-foreground">
          Choose a place, inspect its inputs, then run a design storm. Any
          fallback terrain is labeled illustrative.
        </p>
      </main>
    </div>
  );
}
