import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { FormEvent } from "react";
import { LocationSearch } from "@/components/LocationSearch";

describe("LocationSearch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not call fetch before the 400ms debounce elapses, then calls it after", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<LocationSearch onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "berlin" } });
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("berlin");
  });

  it("shows the five presets when the empty input is focused", () => {
    render(<LocationSearch onSelect={vi.fn()} />);
    fireEvent.focus(screen.getByRole("combobox"));

    expect(screen.getByText("Manhattan, NY")).toBeInTheDocument();
    expect(screen.getByText("Jakarta, ID")).toBeInTheDocument();
    expect(screen.getByText("Copenhagen, DK")).toBeInTheDocument();
    expect(screen.getByText("Lagos, NG")).toBeInTheDocument();
    expect(screen.getByText("Phoenix, AZ")).toBeInTheDocument();
  });

  it("renders option buttons as type=button, not submit", () => {
    // Analyze wraps this list in a <form>. An untyped button defaults to
    // type=submit, so a location pick would submit the form and fire the scan
    // against the pre-flyTo map view. Every option must opt out explicitly.
    render(<LocationSearch onSelect={vi.fn()} />);
    fireEvent.focus(screen.getByRole("combobox"));
    for (const opt of screen.getAllByRole("option")) {
      expect(opt).toHaveAttribute("type", "button");
    }
  });

  it("clicking a preset does not submit an enclosing form", () => {
    const onSubmit = vi.fn((e: FormEvent) => e.preventDefault());
    const onSelect = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <LocationSearch onSelect={onSelect} />
      </form>
    );
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Manhattan, NY"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clicking a search result does not submit an enclosing form", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: "Berlin, Germany", lat: "52.52", lon: "13.405" },
      ],
    } as Response);

    const onSubmit = vi.fn((e: FormEvent) => e.preventDefault());
    const onSelect = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <LocationSearch onSelect={onSelect} />
      </form>
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "berlin" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    fireEvent.click(screen.getByText("Berlin, Germany"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("selects the first option via ArrowDown then Enter", () => {
    const onSelect = vi.fn();
    render(<LocationSearch onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith({
      label: "Manhattan, NY",
      lat: 40.758,
      lng: -73.985,
      zoom: 15,
    });
  });

  it("selects the top hit on Enter with no option highlighted", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: "Berlin, Germany", lat: "52.52", lon: "13.405" },
      ],
    } as Response);

    const onSelect = vi.fn();
    render(<LocationSearch onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "berlin" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    // No ArrowDown first -- typing then Enter should still take the first hit,
    // adding the default zoom the map flies to.
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Berlin, Germany", zoom: 14 })
    );
  });

  it("does nothing on Enter for an empty query with no highlight", () => {
    const onSelect = vi.fn();
    render(<LocationSearch onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    // Presets are shown but none is highlighted -- Enter should not guess one.
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("wraps ArrowUp from nothing highlighted to the last option", () => {
    render(<LocationSearch onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    fireEvent.keyDown(input, { key: "ArrowUp" });

    // 5 presets: indices 0..4. Wrapping up from -1 lands on the last, index 4.
    expect(input).toHaveAttribute("aria-activedescendant", "location-option-4");
  });

  it("closes the dropdown on Escape", () => {
    render(<LocationSearch onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("tracks aria-activedescendant on the input as the highlighted option changes", () => {
    render(<LocationSearch onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    expect(input).not.toHaveAttribute("aria-activedescendant");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "location-option-0");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "location-option-1");
  });

  it("renders a no-matches message for a query with no results", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<LocationSearch onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzzzzzzz" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
  });

  it("clears the highlight when the query changes, so it cannot point at a replaced option", async () => {
    render(<LocationSearch onSelect={vi.fn()} />);
    // Highlight an option in the preset list...
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "location-option-0");

    // ...then type. The option under the old highlight is gone; the highlight
    // must go with it, or Enter would select whatever now sits at index 0.
    fireEvent.change(input, { target: { value: "cope" } });
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("renders clear button when query is entered and clears input on click", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: "Berlin, Germany", lat: "52.52", lon: "13.405" },
      ],
    } as Response);

    render(<LocationSearch onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    expect(screen.queryByRole("button", { name: /clear location search/i })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "berlin" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    const clearBtn = screen.getByRole("button", { name: /clear location search/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    expect(input).toHaveValue("");
    expect(screen.getByText("Manhattan, NY")).toBeInTheDocument();
  });

  it("clears the highlight when new results arrive", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: "Copacabana, Brazil", lat: "40.123", lon: "-73.456" },
      ],
    } as Response);

    render(<LocationSearch onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    // Start a search to populate results
    fireEvent.change(input, { target: { value: "cope" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    // Now highlight an option
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "location-option-0");

    // A fresh search replaces the result set -- the highlight must not survive it.
    fireEvent.change(input, { target: { value: "jak" } });

    // The effect that resets activeIndex on results change fires immediately when state updates
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("never selects an old place while a replacement query is loading", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => [
      { display_name: "Berlin, Germany", lat: "52.52", lon: "13.405" },
    ] } as Response);
    const onSelect = vi.fn();
    render(<LocationSearch onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "berlin" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.getByRole("option", { name: "Berlin, Germany" })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "jakarta" } });
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(/searching/i);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("offers a retry after a service failure and renders the recovered results", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({
      ok: true, json: async () => [{ display_name: "Berlin, Germany", lat: "52.52", lon: "13.405" }],
    } as Response);
    render(<LocationSearch onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "berlin" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.getByRole("status")).toHaveTextContent(/search is unavailable/i);
    expect(screen.queryByText(/no matches/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try search again" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.getByRole("option", { name: "Berlin, Germany" })).toBeInTheDocument();
  });

  it("recovers from a stalled search and ignores its late response", async () => {
    vi.useFakeTimers();
    let finish: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<LocationSearch onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "berlin" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(8_400); });
    expect(screen.getByRole("button", { name: "Try search again" })).toBeInTheDocument();
    await act(async () => { finish({ ok: true, json: async () => [{ display_name: "Late result", lat: "1", lon: "1" }] } as Response); });
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-busy", "false");
  });

  it("reopens a dismissed list with arrow keys and clears the active descendant on Escape", () => {
    render(<LocationSearch onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).not.toHaveAttribute("aria-activedescendant");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeVisible();
    expect(input).toHaveAttribute("aria-activedescendant", "location-option-0");
  });
});
