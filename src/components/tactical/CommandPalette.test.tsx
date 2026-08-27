import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";
import { SensorOpticsProvider, useSensorOptics } from "@/lib/sensor-optics-context";
import { useEffect } from "react";

function TestWrapper({ onSelectCity }: { onSelectCity?: () => void }) {
  const { setCommandPaletteOpen } = useSensorOptics();

  useEffect(() => {
    setCommandPaletteOpen(true);
  }, [setCommandPaletteOpen]);

  return <CommandPalette onSelectCity={onSelectCity} />;
}

function renderWithOptics(ui: React.ReactNode) {
  return render(<SensorOpticsProvider>{ui}</SensorOpticsProvider>);
}

describe("CommandPalette", () => {
  it("renders command palette dialog title and options when open", () => {
    renderWithOptics(<TestWrapper />);

    expect(screen.getByText(/Spatial Intelligence Command Center/i)).toBeInTheDocument();
    expect(screen.getByText(/Night Vision \(NVG\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Thermal FLIR \(Ironbow\)/i)).toBeInTheDocument();
  });

  it("filters options based on search query", () => {
    renderWithOptics(<TestWrapper />);

    const searchInput = screen.getByPlaceholderText(/Type command or speak/i);
    fireEvent.change(searchInput, { target: { value: "NVG" } });

    expect(screen.getByText(/Night Vision \(NVG\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Thermal FLIR \(Ironbow\)/i)).toBeNull();
  });
});
