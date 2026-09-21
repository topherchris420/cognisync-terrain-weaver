import { useCallback, useEffect, useState } from "react";

export interface WeatherAlert {
  id: string;
  event: string;
  headline: string;
  description: string;
  severity: string;
  urgency: string;
  effective: string;
  expires: string;
  areaDesc: string;
}

interface NWSFeature {
  id?: string;
  properties: Omit<WeatherAlert, "id">;
}

const REFRESH_MS = 5 * 60 * 1000;

export function useWeatherAlerts(lat: number, lng: number) {
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(
        `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`,
        { headers: { Accept: "application/geo+json" } },
      );
      if (!response.ok) throw new Error(`NWS returned ${response.status}`);
      const data = (await response.json()) as { features?: NWSFeature[] };
      setAlerts(
        (data.features ?? []).map(({ id, properties }) => ({
          id: id ?? `${properties.event}-${properties.effective}`,
          ...properties,
        })),
      );
      setUpdatedAt(new Date());
      setStatus("ready");
    } catch (error) {
      console.warn("[v0] Weather alert feed unavailable", error);
      setStatus("error");
    }
  }, [lat, lng]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { alerts, status, updatedAt, refresh };
}
