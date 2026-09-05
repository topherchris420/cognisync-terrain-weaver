import { Shield, ShieldAlert, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeterminismReport, StormSeal } from "@/lib/storm-identity";

interface Props {
  seal: StormSeal;
  rerunSeal?: StormSeal | null;
  report?: DeterminismReport | null;
  className?: string;
}

/**
 * Compact square telemetry module for the bottom-right map corner.
 * At-a-glance storm seal identity: seed, hash, forcing, and determinism state.
 */
export function StormTelemetryReadout({ seal, rerunSeal, report, className }: Props) {
  const state: "sealed" | "verified" | "mismatch" = report
    ? report.identical
      ? "verified"
      : "mismatch"
    : "sealed";

  return (
    <div
      className={cn(
        "w-[210px] rounded-none border border-border/70 bg-card/85 backdrop-blur-md font-mono",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/60">
        <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          Storm Seal
        </span>
        <span className="flex items-center gap-1">
          <Radio
            className={cn(
              "h-2.5 w-2.5",
              state === "mismatch" ? "text-destructive" : "text-primary animate-pulse"
            )}
          />
          <span
            className={cn(
              "text-[9px] uppercase tracking-widest",
              state === "verified" && "text-primary",
              state === "sealed" && "text-muted-foreground",
              state === "mismatch" && "text-destructive"
            )}
          >
            {state === "verified" ? "Verified" : state === "mismatch" ? "Mismatch" : "Sealed"}
          </span>
        </span>
      </div>

      {/* Telemetry rows */}
      <dl className="px-2.5 py-2 space-y-1 text-[10px] leading-tight">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground uppercase tracking-wider">Seed</dt>
          <dd className="text-foreground">{seal.shortSeed}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground uppercase tracking-wider">Hash</dt>
          <dd className="text-foreground truncate max-w-[120px]">{seal.storm.hash}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground uppercase tracking-wider">Force</dt>
          <dd className="text-foreground">
            {seal.storm.rainfallDepthMm}mm/{seal.storm.durationMinutes}m
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground uppercase tracking-wider">Runs</dt>
          <dd className="text-foreground">{rerunSeal ? "NOW+POSS" : "NOW"}</dd>
        </div>
      </dl>

      {/* Determinism strip */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 border-t border-border/60 text-[9px] uppercase tracking-widest",
          state === "verified" && "text-primary",
          state === "sealed" && "text-muted-foreground",
          state === "mismatch" && "text-destructive"
        )}
      >
        {state === "mismatch" ? (
          <ShieldAlert className="h-3 w-3" />
        ) : (
          <Shield className="h-3 w-3" />
        )}
        {state === "verified"
          ? "Same storm"
          : state === "mismatch"
            ? `${report?.mismatches.length ?? 0} checks failed`
            : "Awaiting rerun"}
      </div>
    </div>
  );
}
