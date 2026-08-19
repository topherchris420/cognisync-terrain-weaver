import { useState } from "react";
import { Truck, Home, Package, Send, AlertTriangle, CheckCircle, Navigation } from "lucide-react";
import type { SupplyNode, ConvoyAsset } from "@/lib/tactical/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SupplyChainMatrixProps {
  nodes: SupplyNode[];
  convoys: ConvoyAsset[];
  onDispatch: (originId: string, destId: string, cargo: string) => void;
  onSelectNode?: (node: SupplyNode) => void;
  selectedNodeId?: string;
}

export function SupplyChainMatrix({
  nodes,
  convoys,
  onDispatch,
  onSelectNode,
  selectedNodeId,
}: SupplyChainMatrixProps) {
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [originId, setOriginId] = useState<string>(nodes[0]?.id || "");
  const [destId, setDestId] = useState<string>(nodes[1]?.id || "");
  const [cargoType, setCargoType] = useState("5,000L Potable Water + 2,000 MREs");

  const handleDispatch = () => {
    if (!originId || !destId) return;
    onDispatch(originId, destId, cargoType);
    setDispatchOpen(false);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold tracking-wide uppercase font-mono">
            Disaster Logistics Matrix
          </h3>
        </div>

        <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="default" className="h-7 text-xs gap-1.5 font-mono">
              <Send className="h-3 w-3" />
              Dispatch Convoy
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-background/95 border-border/80">
            <DialogHeader>
              <DialogTitle className="text-base font-mono flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                Authorize Emergency Relief Dispatch
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground">Origin Staging Node</label>
                <Select value={originId} onValueChange={setOriginId}>
                  <SelectTrigger className="font-mono text-xs">
                    <SelectValue placeholder="Select Origin" />
                  </SelectTrigger>
                  <SelectContent>
                    {nodes.map((n) => (
                      <SelectItem key={n.id} value={n.id} className="text-xs font-mono">
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground">Destination Shelter / POD</label>
                <Select value={destId} onValueChange={setDestId}>
                  <SelectTrigger className="font-mono text-xs">
                    <SelectValue placeholder="Select Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {nodes.map((n) => (
                      <SelectItem key={n.id} value={n.id} className="text-xs font-mono">
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground">Cargo Manifest</label>
                <Select value={cargoType} onValueChange={setCargoType}>
                  <SelectTrigger className="font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5,000L Potable Water + 2,000 MREs" className="text-xs font-mono">
                      💧 5,000L Potable Water + 2,000 MREs
                    </SelectItem>
                    <SelectItem value="4x 25kVA Generators + Fuel Tank" className="text-xs font-mono">
                      ⚡ 4x 25kVA Generators + Fuel Tank
                    </SelectItem>
                    <SelectItem value="Emergency Trauma Packs + Medical Tents" className="text-xs font-mono">
                      🏥 Emergency Trauma Packs + Medical Tents
                    </SelectItem>
                    <SelectItem value="10,000 Sandbags + Water Pumps" className="text-xs font-mono">
                      🛡️ 10,000 Sandbags + Water Pumps
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={handleDispatch} className="w-full font-mono gap-1.5">
                <Send className="h-3.5 w-3.5" />
                Sign & Transmit Dispatch Order (GovCloud Enforced)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Logistics Nodes List */}
      <div className="space-y-2.5 overflow-y-auto max-h-[220px] pr-1 scrollbar-thin">
        {nodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const isLowSupply = node.days_of_supply < 2.0;

          return (
            <div
              key={node.id}
              onClick={() => onSelectNode?.(node)}
              className={cn(
                "p-3 rounded-lg border transition-all cursor-pointer",
                isSelected
                  ? "border-emerald-500 bg-emerald-950/20 ring-1 ring-emerald-500/40"
                  : isLowSupply
                  ? "border-amber-500/40 bg-amber-950/20 hover:bg-amber-900/30"
                  : "border-border/60 bg-muted/20 hover:bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-background/80 border border-border/40">
                    <Home className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold leading-tight line-clamp-1">
                      {node.name}
                    </h4>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 uppercase">
                      Type: {node.type.replace("_", " ")}
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono",
                    isLowSupply
                      ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                      : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                  )}
                >
                  {node.days_of_supply.toFixed(1)} DOS
                </Badge>
              </div>

              {node.max_capacity && node.current_occupancy && (
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono mb-1">
                    <span>Occupancy: {node.current_occupancy} / {node.max_capacity}</span>
                    <span>{Math.round((node.current_occupancy / node.max_capacity) * 100)}%</span>
                  </div>
                  <Progress
                    value={(node.current_occupancy / node.max_capacity) * 100}
                    className="h-1.5 bg-background"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Convoy Tracking */}
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-primary" />
          Active Relief Convoys ({convoys.length})
        </h4>
        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
          {convoys.map((convoy) => (
            <div
              key={convoy.id}
              className="p-2 rounded-lg border border-border/40 bg-muted/10 flex items-center justify-between text-xs font-mono"
            >
              <div>
                <div className="font-semibold text-primary">{convoy.callsign}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                  {convoy.cargo_description}
                </div>
              </div>
              <div className="text-right shrink-0">
                <Badge variant="outline" className="text-[10px] border-sky-500/40 text-sky-300">
                  ETA {Math.ceil(convoy.eta_minutes)}m
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
