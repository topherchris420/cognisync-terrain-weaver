import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SensorOpticsProvider } from "@/lib/sensor-optics-context";
import Analyze from "./Analyze";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/hooks/useWelikia1609", () => ({ useWelikia1609: () => ({ status: "idle" }) }));
vi.mock("@/components/historical/Historical1609Panel", () => ({ Historical1609Panel: () => null }));
vi.mock("@/components/MapView", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return { MapView: forwardRef(function OfflineMap(_props, ref) {
    useImperativeHandle(ref, () => ({ fitBounds: vi.fn(), getBounds: () => null, getMap: () => null }));
    return <div aria-label="Offline map" />;
  }) };
});

describe("atlas first-use experience", () => {
  it("opens an example without a ready map or analysis request and resets cleanly", () => {
    render(<MemoryRouter><SensorOpticsProvider><Analyze /></SensorOpticsProvider></MemoryRouter>);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(screen.getByRole("button", { name: /acquiring satellite feed/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /explore an example/i }));
    expect(screen.getByText("Illustrative example")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: /urban resilience workbench/i })).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Storm Sim" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("slider", { name: /rainfall depth/i })).toHaveValue("50");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("button", { name: /explore an example/i })).toBeInTheDocument();
    expect(screen.queryByText("Illustrative example")).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });
});
