import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TacticalHUD } from "./TacticalHUD";
import { SensorOpticsProvider } from "@/lib/sensor-optics-context";

function renderWithOptics(ui: React.ReactNode) {
  return render(<SensorOpticsProvider>{ui}</SensorOpticsProvider>);
}

describe("TacticalHUD", () => {
  it("does not render when HUD is closed", () => {
    renderWithOptics(
      <TacticalHUD lat={40.758} lng={-73.985} zoom={15} />
    );
    expect(screen.queryByText(/GEOINT HUD ::/i)).toBeNull();
  });

  it("renders coordinates, grid locator, and metrics when HUD is active", () => {
    renderWithOptics(
      <TacticalHUD
        lat={40.758}
        lng={-73.985}
        zoom={15}
        surfaceAreaKm2={1.42}
        absorptionScore={64.2}
      />
    );

    // Press 'h' key to open HUD
    fireEvent.keyDown(window, { key: "h" });

    expect(screen.getByText(/GEOINT HUD ::/i)).toBeInTheDocument();
    expect(screen.getByText(/GRID: FN30as/i)).toBeInTheDocument();
    expect(screen.getAllByText(/40.75800°/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/64.2\/100/i)).toBeInTheDocument();
  });
});
