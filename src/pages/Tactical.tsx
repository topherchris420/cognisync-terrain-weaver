import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { TacticalCOP } from "@/components/tactical/TacticalCOP";
import { useSearchParams } from "react-router-dom";
import type { FlowPath, RiskZone } from "@/lib/simulation-types";

export default function TacticalPage() {
  const [searchParams] = useSearchParams();
  
  // Center coordinates from query params or default Manhattan
  const lat = parseFloat(searchParams.get("lat") || "40.7128");
  const lng = parseFloat(searchParams.get("lng") || "-74.006");
  const label = searchParams.get("label") || "Manhattan Tactical Sector";

  // Mock flow paths & risk zones if navigated from simulation
  const [flowPaths, setFlowPaths] = useState<FlowPath[]>([]);
  const [riskZones, setRiskZones] = useState<RiskZone[]>([]);

  useEffect(() => {
    // Generate realistic hydrodynamic flow lines around current center
    const simFlows: FlowPath[] = [
      {
        points: [
          [lng - 0.004, lat + 0.003],
          [lng - 0.002, lat + 0.001],
          [lng + 0.001, lat - 0.002],
          [lng + 0.004, lat - 0.004],
        ],
        volume_m3: 680,
        velocity_mps: 2.1,
      },
      {
        points: [
          [lng - 0.008, lat - 0.002],
          [lng - 0.005, lat - 0.004],
          [lng - 0.001, lat - 0.005],
        ],
        volume_m3: 390,
        velocity_mps: 1.4,
      },
    ];

    const simZones: RiskZone[] = [
      {
        polygon: [
          [lng - 0.003, lat - 0.003],
          [lng + 0.003, lat - 0.003],
          [lng + 0.002, lat - 0.006],
          [lng - 0.004, lat - 0.005],
        ],
        level: "severe",
        affected_area_km2: 0.28,
      },
    ];

    setFlowPaths(simFlows);
    setRiskZones(simZones);
  }, [lat, lng]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppNav />
      <main id="main" className="flex-1">
        <TacticalCOP
          initialCenter={[lng, lat]}
          flowPaths={flowPaths}
          riskZones={riskZones}
          locationLabel={label}
        />
      </main>
    </div>
  );
}
