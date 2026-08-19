import { useState, useEffect, useCallback, useRef } from "react";
import type {
  TacticalCOPState,
  IoTSensor,
  ConvoyAsset,
  TacticalAlert,
  SupplyNode,
} from "./types";
import { generateTacticalAssets } from "./generator";
import { generateAuditEntry } from "./compliance";
import type { FlowPath, RiskZone } from "@/lib/simulation-types";
import { evaluateCorridorHazard } from "./routing";

export interface TacticalStreamOptions {
  centerLat: number;
  centerLng: number;
  bbox?: { north: number; south: number; east: number; west: number } | null;
  flowPaths?: FlowPath[];
  riskZones?: RiskZone[];
  autoTick?: boolean;
}

export function useTacticalStream({
  centerLat,
  centerLng,
  bbox,
  flowPaths = [],
  riskZones = [],
  autoTick = true,
}: TacticalStreamOptions) {
  const [state, setState] = useState<TacticalCOPState>(() =>
    generateTacticalAssets(centerLat, centerLng, bbox)
  );

  const [auditLog, setAuditLog] = useState(() => [
    generateAuditEntry("SYSTEM", "INITIALIZE_EOC_TACTICAL_COP", "BBOX_SECTOR"),
    generateAuditEntry("FIPS_HSM", "ENFORCE_GOVCLOUD_CRYPTO", "FEDRAMP_HIGH"),
  ]);

  // Keep track of flow paths and risk zones to re-evaluate corridors when simulations run
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      corridors: prev.corridors.map((c) => {
        const hazard = evaluateCorridorHazard(c, flowPaths, riskZones);
        return {
          ...c,
          ...hazard,
        };
      }),
    }));
  }, [flowPaths, riskZones]);

  // Live telemetry pulse tick (every 3.5 seconds)
  useEffect(() => {
    if (!autoTick) return;

    const interval = setInterval(() => {
      setState((prev) => {
        // Multiplier based on weather intensity
        const intensityMult =
          prev.weather_intensity === "cat_4_hurricane"
            ? 1.5
            : prev.weather_intensity === "cloudburst_50mm"
            ? 1.1
            : prev.weather_intensity === "tropical_storm"
            ? 0.9
            : 0.4;

        // 1. Mutate sensors slightly
        const updatedSensors: IoTSensor[] = prev.sensors.map((s) => {
          const delta = (Math.random() - 0.45) * 1.2 * intensityMult;
          let newReading = Math.max(0, Number((s.reading + delta).toFixed(2)));
          if (s.type === "soil_moisture") {
            newReading = Math.min(100, Math.max(10, newReading));
          }

          let status: IoTSensor["status"] = "normal";
          if (newReading >= s.threshold_emergency) {
            status = "critical";
          } else if (newReading >= s.threshold_warning) {
            status = "warning";
          }

          const newHistory = [
            ...s.historical_readings.slice(-4),
            { timestamp: "Now", value: newReading },
          ];

          return {
            ...s,
            reading: newReading,
            status,
            battery_pct: Math.max(10, s.battery_pct - 0.01),
            last_ping: new Date().toISOString(),
            historical_readings: newHistory,
          };
        });

        // 2. Progress convoys
        const updatedConvoys: ConvoyAsset[] = prev.convoys.map((c) => {
          if (c.status === "en_route") {
            const remaining = Math.max(0, c.eta_minutes - 0.5);
            return {
              ...c,
              eta_minutes: remaining,
              status: remaining === 0 ? "delivered" : "en_route",
            };
          }
          return c;
        });

        return {
          ...prev,
          sensors: updatedSensors,
          convoys: updatedConvoys,
        };
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [autoTick]);

  // Dispatch Convoy Action
  const dispatchResupply = useCallback(
    (originId: string, destId: string, cargo: string) => {
      const origin = state.supply_nodes.find((n) => n.id === originId);
      const dest = state.supply_nodes.find((n) => n.id === destId);
      if (!origin || !dest) return;

      const newConvoy: ConvoyAsset = {
        id: `convoy-tactical-${Date.now().toString(36)}`,
        callsign: `Convoy RAPID-${Math.floor(10 + Math.random() * 90)}`,
        origin_id: originId,
        destination_id: destId,
        coordinates: [
          (origin.coordinates[0] + dest.coordinates[0]) / 2,
          (origin.coordinates[1] + dest.coordinates[1]) / 2,
        ],
        cargo_description: cargo,
        status: "en_route",
        eta_minutes: 18,
        hazard_reroute_count: 0,
      };

      setState((prev) => ({
        ...prev,
        convoys: [newConvoy, ...prev.convoys],
      }));

      setAuditLog((prev) => [
        generateAuditEntry("EOC_DISPATCHER", "DISPATCH_SUPPLY_CONVOY", newConvoy.callsign),
        ...prev.slice(0, 49),
      ]);
    },
    [state.supply_nodes]
  );

  // Acknowledge Alert Action
  const acknowledgeAlert = useCallback((alertId: string) => {
    setState((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) =>
        a.id === alertId ? { ...a, acknowledged: true } : a
      ),
    }));

    setAuditLog((prev) => [
      generateAuditEntry("INCIDENT_COMMANDER", "ACKNOWLEDGE_TACTICAL_ALERT", alertId),
      ...prev.slice(0, 49),
    ]);
  }, []);

  // Weather Intensity Toggle
  const setWeatherIntensity = useCallback(
    (intensity: TacticalCOPState["weather_intensity"]) => {
      setState((prev) => ({
        ...prev,
        weather_intensity: intensity,
      }));

      setAuditLog((prev) => [
        generateAuditEntry("METEOROLOGIST", "SET_SIMULATED_WEATHER_INTENSITY", intensity),
        ...prev.slice(0, 49),
      ]);
    },
    []
  );

  return {
    state,
    auditLog,
    dispatchResupply,
    acknowledgeAlert,
    setWeatherIntensity,
  };
}
