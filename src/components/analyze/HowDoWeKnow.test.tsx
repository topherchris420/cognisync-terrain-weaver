import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HowDoWeKnow } from "./HowDoWeKnow";
import { EvidencePanel } from "./EvidencePanel";
import { EXAMPLE_ANALYSIS } from "@/lib/example-analysis";

describe("How do we know?", () => {
  it("sits beneath the three questions and marks the failed routing validation", () => {
    render(<HowDoWeKnow />);
    for (const question of ["What was?", "What is?", "What could be?"]) expect(screen.getByText(question)).toBeInTheDocument();
    const routing = screen.getByText("Routed accumulation zones").closest("li")!;
    expect(within(routing).getByText("Did not hold")).toBeInTheDocument();
    expect(routing).toHaveTextContent(/no better than chance/);
    const history = screen.getByText(/1609 reconstruction/).closest("li")!;
    expect(within(history).getByText("Reconstructed")).toBeInTheDocument();
    expect(within(history).getByText("Unvalidated")).toBeInTheDocument();
  });
});

describe("classification sensitivity uses measured error", () => {
  it("defaults to the benchmark-derived range and labels a custom range as a what-if", () => {
    render(<EvidencePanel analysis={EXAMPLE_ANALYSIS} image={null} />);
    expect(screen.getByLabelText(/Benchmark-derived ±7 pp/)).toBeChecked();
    expect(screen.getByLabelText("Classification sensitivity envelope")).toHaveTextContent(/Pavement/);
    fireEvent.click(screen.getByLabelText(/Choose my own/));
    expect(screen.getByText(/not derived from measurement/)).toBeInTheDocument();
    expect(screen.getByText(/not a confidence interval/)).toBeInTheDocument();
  });
});
