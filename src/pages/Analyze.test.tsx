import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Analyze from "./Analyze";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";
import { SensorOpticsProvider } from "@/lib/sensor-optics-context";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), capture: vi.fn(), storm: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/lib/hydrology", () => ({ LOCAL_GRID: { low: 30, medium: 60, high: 90 }, runLocalStorm: mocks.storm }));
vi.mock("@/hooks/useWelikia1609", () => ({ useWelikia1609: () => ({ status: "idle" }) }));
vi.mock("@/components/historical/Historical1609Panel", () => ({ Historical1609Panel: () => null }));
vi.mock("@/components/MapView", async () => {
  const { forwardRef, useEffect, useImperativeHandle, useRef } = await import("react");
  return { MapView: forwardRef(function TestMap(props: { onReady: () => void }, ref) {
    useImperativeHandle(ref, () => ({ fitBounds: vi.fn(), getBounds: () => [[-74.01, 40.7], [-74, 40.71]], getMap: () => null, captureImage: mocks.capture }));
    const ready = useRef(props.onReady);
    useEffect(() => { ready.current(); }, []);
    return null;
  }) };
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
describe("Analyze request lifecycle", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.capture.mockResolvedValue("data:image/png;base64,test"); });
  const mount = () => render(<MemoryRouter><SensorOpticsProvider><Analyze /></SensorOpticsProvider></MemoryRouter>);
  it("starts only one capture for same-tick launch shortcuts", () => {
    mocks.capture.mockReturnValue(deferred<string>().promise);
    mount();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true }));
    });
    expect(mocks.capture).toHaveBeenCalledTimes(1);
  });
  it("does not classify after unmount during capture", async () => {
    const capture = deferred<string>();
    mocks.capture.mockReturnValue(capture.promise);
    const page = mount();
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    page.unmount();
    await act(async () => { capture.resolve("data:image/png;base64,test"); });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("keeps a newly opened example when cancelled classification completes", async () => {
    const request = deferred<{ data: { analysis: typeof EXAMPLE_ANALYSIS }; error: null }>();
    mocks.invoke.mockReturnValue(request.promise);
    mount();
    await act(async () => { fireEvent.keyDown(window, { key: "Enter", ctrlKey: true }); });
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
    fireEvent.click(screen.getByRole("button", { name: /explore an example/i }));
    await act(async () => { request.resolve({ data: { analysis: { ...EXAMPLE_ANALYSIS, status: "complete", location_label: "Obsolete site" } }, error: null }); });
    expect(screen.getByText("Illustrative example")).toBeVisible();
    expect(screen.queryByText("Obsolete site")).not.toBeInTheDocument();
  });
  it("reset invalidates pending storm completion", async () => {
    const storm = deferred<never>();
    mocks.storm.mockReturnValue(storm.promise);
    mount();
    fireEvent.click(screen.getByRole("button", { name: /explore an example/i }));
    fireEvent.click(screen.getByRole("button", { name: /route 50 mm/i }));
    expect(mocks.storm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Reset" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await act(async () => { storm.resolve(undefined as never); });
    expect(screen.getByRole("button", { name: /explore an example/i })).toBeVisible();
  });
});
import {
  buildRealitySimulationRequest,
  buildStormDefinition,
} from "./Analyze";
import { buildRealitySurface } from "@/lib/counterfactual/modifiers";

const bbox = {
  north: 40.71,
  south: 40.7,
  east: -74,
  west: -74.01,
};

const provenance = [{
  sourceId: "test",
  title: "Test",
  agency: "Test",
  url: "https://example.test/source",
  accessedAt: "2026-08-10",
  confidence: "high" as const,
  status: "observed" as const,
  caveats: [],
}];

describe("Analyze counterfactual request orchestration", () => {
  it("builds NOW and POSSIBLE requests under one immutable storm", () => {
    const storm = buildStormDefinition(50, "low");
    const now = buildRealitySurface({
      id: "now",
      baselineLayerHash: "baseline:fixed",
      bbox,
      rows: 30,
      cols: 30,
      features: [],
      provenance,
      warnings: [],
    });
    const possible = {
      ...now,
      id: "possible" as const,
      interventionHash: "intervention:edited",
      surfaceHash: "surface:edited",
    };

    const nowRequest = buildRealitySimulationRequest(bbox, storm, now);
    const possibleRequest = buildRealitySimulationRequest(
      bbox,
      storm,
      possible,
      "fnv1a64:1111111111111111"
    );

    expect(nowRequest.storm).toBe(storm);
    expect(possibleRequest.storm).toBe(storm);
    expect(nowRequest.surface.id).toBe("now");
    expect(possibleRequest.surface.id).toBe("possible");
    expect(possibleRequest.expectedElevationHash).toBe(
      "fnv1a64:1111111111111111"
    );
    expect(nowRequest.surface.surfaceHash).not.toBe(
      possibleRequest.surface.surfaceHash
    );
  });

  it("never enables unsupported drainage", () => {
    expect(buildStormDefinition(50, "medium").includeDrainage).toBe(false);
  });
});
