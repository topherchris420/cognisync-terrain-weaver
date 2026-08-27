import { useState } from "react";
import { Truck, Warehouse, Send, Activity } from "lucide-react";
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
  const [cargoType, setCargoType] = useState("2x 12-Inch Godwin High-Volume Pumps + Hose Line");

  const handleDispatch = () => {
    if (!originId || !destId) return;
    onDispatch(originId, destId, cargoType);
    setDispatchOpen(false);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold tracking-wide uppercase font-mono text-foreground">
            DPW Staging Yards & Shelters
          </h3>
        </div>

        <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-6 text-xs gap-1 font-mono border-primary/40 text-primary hover:bg-primary/10">
              <Send className="h-2.5 w-2.5" />
              Dispatch Equipment
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border/80">
            <DialogHeader>
              <DialogTitle className="text-sm font-mono flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                Authorize Municipal Resource Deployment
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-muted-foreground">Origin Staging Yard</label>
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
                <label className="text-muted-foreground">Destination Sector / Pumping Facility</label>
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
                <label className="text-muted-foreground">Equipment / Material Manifest</label>
                <Select value={cargoType} onValueChange={setCargoType}>
                  <SelectTrigger className="font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2x 12-Inch Godwin High-Volume Pumps + Hose Line" className="text-xs font-mono">
                      Type II De-Watering Pumps (5,000 GPM) + Hose Line
                    </SelectItem>
                    <SelectItem value="500 LF Rapid-Deploy Inflatable Flood Barrier Spool" className="text-xs font-mono">
                      500 LF Rapid-Deploy Inflatable Flood Barrier Spool
                    </SelectItem>
                    <SelectItem value="Bulk Sandbag Deployment Pod (5,000 Units)" className="text-xs font-mono">
                      Bulk Sandbag Deployment Pod (5,000 Units)
                    </SelectItem>
                    <SelectItem value="45kVA Mobile Trailer Generator + Fuel Tank" className="text-xs font-mono">
                      45kVA Mobile Trailer Generator + Fuel Tank
                    </SelectItem>
                    <SelectItem value="Potable Water Distribution Pod (2,000 gal)" className="text-xs font-mono">
                      Potable Water Distribution Pod (2,000 gal)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={handleDispatch} className="w-full font-mono gap-1 text-xs">
                <Send className="h-3 w-3" />
                Issue Emergency Dispatch Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Logistics Nodes List */}
      <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1 scrollbar-thin">
        {nodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const daysOfSupply = node.days_of_supply ?? 0;
          const isLowSupply = daysOfSupply < 2.0;

          return (
            <div
              key={node.id}
              onClick={() => onSelectNode?.(node)}
              className={cn(
                "p-2.5 rounded-md border transition-all cursor-pointer bg-card/60",
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                  : "border-border/60 hover:border-border hover:bg-card"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-background/80 border border-border/50">
                    <Warehouse className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-xs font-medium leading-tight text-foreground line-clamp-1">
                      {node.name}
                    </h4>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 uppercase">
                      Type: {node.type ? node.type.replace("_", " ") : ""}
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono",
                    isLowSupply
                      ? "border-warning/60 text-warning bg-warning/10"
                      : "border-border text-muted-foreground bg-muted/20"
                  )}
                >
                  {daysOfSupply.toFixed(1)} DOS
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
                    className="h-1 bg-background"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Convoy Tracking */}
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5 font-mono">
          <Truck className="h-3.5 w-3.5 text-primary" />
          Active Relief & Public Works Convoys ({convoys.length})
        </h4>
        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
          {convoys.map((convoy) => (
            <div
              key={convoy.id}
              className="p-2 rounded-md border border-border/50 bg-background/50 flex items-center justify-between text-xs font-mono"
            >
              <div>
                <div className="font-medium text-foreground">{convoy.callsign}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                  {convoy.cargo_description}
                </div>
              </div>
              <div className="text-right shrink-0">
                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
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
