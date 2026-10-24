import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SensorOpticsProvider } from "@/lib/sensor-optics-context";
import Analyze from "./Analyze";

const invoke = vi.hoisted(() => vi.fn());
const pdf = vi.hoisted(() => ({ generate: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/pdf-export", () => ({ generatePDFReport: pdf.generate }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/lib/hydrology", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/hydrology")>();
  return { ...original, runLocalStorm: (input: import("@/lib/hydrology").LocalStormInput) => original.runLocalStorm(input, async () => new Response(null, { status: 503 })) };
});
vi.mock("@/lib/hydrology/drainage", () => ({
  fetchDrainageGrid: async () => ({ status: "unavailable" as const, basins: 0, capacityM3: [], sourceLabel: "test" }),
}));
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
  it("lets visitors use the map and return to setup without starting a request", () => {
    render(<MemoryRouter><SensorOpticsProvider><Analyze /></SensorOpticsProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /explore the map/i }));
    expect(screen.queryByRole("complementary", { name: /start a resilience study/i })).not.toBeInTheDocument();
    const reopen = screen.getByRole("button", { name: /choose a study area/i });
    expect(reopen).toHaveFocus();
    fireEvent.click(reopen);
    expect(screen.getByRole("combobox", { name: /city or address/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /explore the map/i })).toHaveFocus();
  });

  it("connects each selected tab to its panel and guides an out-of-order comparison", async () => {
    render(<MemoryRouter><SensorOpticsProvider><Analyze /></SensorOpticsProvider></MemoryRouter>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /explore an example/i })); });
    const overview = screen.getByRole("tab", { name: "Overview" });
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toHaveAttribute("id", overview.getAttribute("aria-controls"));
    expect(screen.getByRole("tabpanel", { name: "Overview" })).not.toContainElement(screen.getByRole("group", { name: "Next study step" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose a storm" }));
    expect(screen.getByRole("tab", { name: "Storm" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("slider", { name: /rainfall depth/i })).toHaveValue("50");
    fireEvent.click(within(screen.getByRole("group", { name: "Quick rainfall amounts" })).getByRole("button", { name: "100 mm" }));
    expect(screen.getByRole("slider", { name: /rainfall depth/i })).toHaveValue("100");
    expect(screen.getByRole("button", { name: "Route 100 mm storm" })).toBeEnabled();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Compare" }), { button: 0, ctrlKey: false });
    const guidance = screen.getByRole("region", { name: "Study guidance" });
    expect(guidance).toHaveTextContent(/start by routing a storm/i);
    fireEvent.click(within(screen.getByRole("group", { name: "Next study step" })).getByRole("button", { name: "Choose a storm" }));
    const storm = screen.getByRole("tab", { name: "Storm" });
    expect(screen.getByRole("tabpanel", { name: "Storm" })).toHaveAttribute("id", storm.getAttribute("aria-controls"));
  });

  it("restores the current step and keyboard focus after collapsing the study", async () => {
    render(<MemoryRouter><SensorOpticsProvider><Analyze /></SensorOpticsProvider></MemoryRouter>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /explore an example/i })); });
    fireEvent.click(screen.getByRole("button", { name: "Choose a storm" }));
    fireEvent.change(screen.getByRole("slider", { name: /rainfall depth/i }), { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: "Collapse panel" }));
    expect(screen.getByRole("button", { name: /show study/i })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: /show study/i }));
    expect(screen.getByRole("tab", { name: "Storm" })).toHaveFocus();
    expect(screen.getByRole("slider", { name: /rainfall depth/i })).toHaveValue("75");
  });

  it("keeps a routed study until the user confirms starting over", async () => {
    render(<MemoryRouter><SensorOpticsProvider><Analyze /></SensorOpticsProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /explore an example/i }));
    fireEvent.click(screen.getByRole("button", { name: "Choose a storm" }));
    fireEvent.click(screen.getByRole("button", { name: /route 50 mm/i }));
    await screen.findByText(/of modeled rainfall became surface runoff/i);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("alertdialog")).toBeVisible();
    expect(screen.getByRole("button", { name: /export current study/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Keep working" }));
    expect(screen.getByText("50 mm in 60 min")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Start new study" }));
    expect(screen.getByRole("button", { name: /explore an example/i })).toBeVisible();
    expect(screen.queryByText("50 mm in 60 min")).not.toBeInTheDocument();
  });

  it("opens an example without a ready map or analysis request and resets cleanly", () => {
    render(<MemoryRouter><SensorOpticsProvider><Analyze /></SensorOpticsProvider></MemoryRouter>);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(screen.getByRole("button", { name: /acquiring satellite feed/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /explore an example/i }));
    expect(screen.getByText("Illustrative example")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: /urban resilience workbench/i })).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Storm" }), { button: 0, ctrlKey: false });
    const rainfall = screen.getByRole("slider", { name: /rainfall depth/i });
    expect(rainfall).toHaveValue("50");
    expect(screen.getAllByRole("slider", { name: /rainfall/i })).toHaveLength(1);
    const initialRunoff = screen.getByTestId("storm-estimate-runoff").textContent;
    fireEvent.change(rainfall, { target: { value: "100" } });
    expect(screen.getByTestId("storm-estimate-runoff").textContent).not.toBe(initialRunoff);
    expect(screen.getByText(/rational method/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /route 100 mm storm/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("button", { name: /explore an example/i })).toBeInTheDocument();
    expect(screen.queryByText("Illustrative example")).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("leads a routed storm with its answer and holds the rerun until something is drawn", async () => {
    render(<MemoryRouter><SensorOpticsProvider><Analyze /></SensorOpticsProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /explore an example/i }));
    fireEvent.click(screen.getByRole("button", { name: "Choose a storm" }));
    fireEvent.click(screen.getByRole("button", { name: /route 50 mm/i }));
    expect(await screen.findByText(/of modeled rainfall became surface runoff/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What the storm did" })).toHaveFocus();
    expect(screen.getByText("50 mm in 60 min")).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /rainfall depth/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /redesign the ground/i }));
    expect(screen.getByRole("button", { name: /rerun the same storm/i })).toBeDisabled();
    expect(screen.getByText(/draw at least one shape/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /green roofs/i })).toBeDisabled();
  });
});

describe("share and export experience", () => {
  it("reopens the selected era and relief, then shares the changed view", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<MemoryRouter initialEntries={["/?lat=40.71&lng=-74.01&zoom=14&era=2018&terrain=1&relief=3"]}>
      <SensorOpticsProvider><Analyze /></SensorOpticsProvider>
    </MemoryRouter>);
    expect(screen.getByRole("radio", { name: "2018" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "3×" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("radio", { name: "2024" }));
    fireEvent.click(screen.getByRole("button", { name: "6×" }));
    fireEvent.click(screen.getByRole("button", { name: "Share map view" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const params = new URL(writeText.mock.calls[0][0]).searchParams;
    expect(params.get("era")).toBe("2024");
    expect(params.get("relief")).toBe("6");
    expect(params.get("lat")).toBe("40.71000");
    expect(params.get("terrain")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Compare historical eras" }));
    expect(screen.getByLabelText("Era for pane 1")).toHaveValue("2024");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("radio", { name: "2018" }));
    fireEvent.click(screen.getByRole("button", { name: "Compare historical eras" }));
    expect(screen.getByLabelText("Era for pane 1")).toHaveValue("2018");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("generates a PDF on demand and recovers after a failed export", async () => {
    pdf.generate.mockReset().mockImplementationOnce(() => { throw new Error("Export unavailable"); })
      .mockReturnValue({ save: pdf.save });
    pdf.save.mockClear();
    render(<MemoryRouter><SensorOpticsProvider><Analyze /></SensorOpticsProvider></MemoryRouter>);
    expect(pdf.generate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /explore an example/i }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Export" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("button", { name: /PDF resilience dossier/ }));
    await waitFor(() => expect(pdf.generate).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("button", { name: /PDF resilience dossier/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /PDF resilience dossier/ }));
    await waitFor(() => expect(pdf.save).toHaveBeenCalledOnce());
    expect(pdf.generate).toHaveBeenLastCalledWith(expect.objectContaining({ status: "example" }), expect.any(Object));
  });
});
