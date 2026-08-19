import { useState } from "react";
import { ShieldCheck, Lock, Activity, Server, FileText, CheckCircle2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MUNICIPAL_OPERATIONAL_CONTROLS, DEFAULT_GOVCLOUD_POSTURE, type AuditLogEntry } from "@/lib/tactical/compliance";

interface GovCloudBadgeProps {
  auditLog: AuditLogEntry[];
}

export function GovCloudBadge({ auditLog }: GovCloudBadgeProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 bg-muted/20 border-border/70 text-foreground/90 hover:bg-muted/40 hover:text-foreground transition-all font-mono text-xs shadow-none"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
          <span className="font-medium">GIS & SCADA Node</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">| TLS 1.3</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl bg-card border-border/80 backdrop-blur-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-mono">
                Municipal Operations & SCADA Telemetry Node
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-mono">
                USGS NWIS & NOAA Ingestion Node | Catchment Telemetry Active
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Posture Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-md border border-border/50 bg-background/50">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono text-muted-foreground">
                <Server className="h-3 w-3 text-primary" />
                Infrastructure
              </div>
              <p className="text-xs font-medium mt-1 font-mono">{DEFAULT_GOVCLOUD_POSTURE.environment}</p>
            </div>
            <div className="p-2.5 rounded-md border border-border/50 bg-background/50">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono text-muted-foreground">
                <Lock className="h-3 w-3 text-primary" />
                Payload Security
              </div>
              <p className="text-xs font-medium mt-1 font-mono">TLS 1.3 / AES-256</p>
            </div>
            <div className="p-2.5 rounded-md border border-border/50 bg-background/50">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono text-muted-foreground">
                <Activity className="h-3 w-3 text-primary" />
                Telemetry Feed
              </div>
              <p className="text-xs font-medium mt-1 font-mono">USGS & City SCADA</p>
            </div>
            <div className="p-2.5 rounded-md border border-border/50 bg-background/50">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-primary" />
                Audit Trail
              </div>
              <p className="text-xs font-medium mt-1 font-mono">Continuous Ledger</p>
            </div>
          </div>

          {/* Operational Controls */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5 font-mono">
              <FileText className="h-3.5 w-3.5" />
              Operational & Geospatial Protocols
            </h4>
            <div className="grid sm:grid-cols-2 gap-2">
              {MUNICIPAL_OPERATIONAL_CONTROLS.map((control) => (
                <div
                  key={control.id}
                  className="p-2.5 rounded-md border border-border/40 bg-background/30 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-primary">
                      {control.id}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/60">
                      {control.status}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium mt-1">{control.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {control.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Immutable Audit Log Stream */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between font-mono">
              <span>Incident Command & Dispatch Log</span>
              <span className="text-[10px] text-primary">● LIVE AUDIT FEED</span>
            </h4>
            <div className="h-36 overflow-y-auto rounded-md border border-border/50 bg-background/80 p-2 font-mono text-[11px] space-y-1 scrollbar-thin">
              {auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-2 p-1 rounded bg-muted/10 border-b border-border/20"
                >
                  <div>
                    <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</span>{" "}
                    <span className="text-primary font-medium">[{entry.actor}]</span>{" "}
                    <span className="text-foreground">{entry.action}</span>{" "}
                    <span className="text-muted-foreground">→ {entry.resource}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 shrink-0">
                    {entry.checksum.slice(0, 14)}...
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
