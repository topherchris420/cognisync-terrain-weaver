import { useState } from "react";
import { ShieldCheck, Lock, Activity, Server, FileText, CheckCircle2 } from "lucide-react";
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
import { FEDRAMP_HIGH_CONTROLS, DEFAULT_GOVCLOUD_POSTURE, type AuditLogEntry } from "@/lib/tactical/compliance";

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
          className="h-8 gap-2 bg-emerald-950/30 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300 transition-all font-mono text-xs shadow-sm"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          <span className="font-semibold">FEDRAMP HIGH</span>
          <span className="text-[10px] opacity-75 hidden sm:inline">| GovCloud US</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl bg-background/95 border-border/80 backdrop-blur-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-mono">
                FedRAMP GovCloud Security Posture
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-mono">
                Boundary Authorization ID: FEDRAMP-ATO-2026-0819 | DoD IL5 CUI Certified
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Posture Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Server className="h-3.5 w-3.5 text-primary" />
                Infrastructure
              </div>
              <p className="text-xs font-semibold mt-1 font-mono">{DEFAULT_GOVCLOUD_POSTURE.environment}</p>
            </div>
            <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                Cryptography
              </div>
              <p className="text-xs font-semibold mt-1 font-mono">FIPS 140-3 (HSM)</p>
            </div>
            <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-sky-400" />
                Sovereignty
              </div>
              <p className="text-xs font-semibold mt-1 font-mono text-emerald-400">US Persons Only</p>
            </div>
            <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-purple-400" />
                Audit Stream
              </div>
              <p className="text-xs font-semibold mt-1 font-mono">Immutable / Zero-Trust</p>
            </div>
          </div>

          {/* Security Controls */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Enforced NIST SP 800-53 Rev. 5 Controls
            </h4>
            <div className="grid sm:grid-cols-2 gap-2">
              {FEDRAMP_HIGH_CONTROLS.map((control) => (
                <div
                  key={control.id}
                  className="p-2.5 rounded-lg border border-border/40 bg-muted/10 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-primary">
                      {control.id}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
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
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
              <span>Zero-Trust Incident Dispatch Audit Stream</span>
              <span className="font-mono text-[10px] text-emerald-400">● LIVE REPLICATION</span>
            </h4>
            <div className="h-40 overflow-y-auto rounded-lg border border-border/50 bg-black/40 p-2 font-mono text-[11px] space-y-1.5 scrollbar-thin">
              {auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-2 p-1 rounded bg-muted/5 border-b border-border/20"
                >
                  <div>
                    <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</span>{" "}
                    <span className="text-sky-400 font-semibold">[{entry.actor}]</span>{" "}
                    <span className="text-foreground">{entry.action}</span>{" "}
                    <span className="text-muted-foreground">→ {entry.resource}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">
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
