import { useRef, type PointerEvent } from "react";

/** Vertical travel (px) that turns a press on the grip into a swipe. */
const SWIPE_THRESHOLD_PX = 24;

interface Props {
  /** True while the sheet is lowered so the map shows above it. */
  peek: boolean;
  onPeekChange: (peek: boolean) => void;
  controls: string;
}

/**
 * The handle of the phone bottom sheet. A tap toggles between the full study
 * and a lowered sheet that leaves the map visible; a swipe down lowers it and
 * a swipe up raises it. Hidden on wider screens, where the panel is docked.
 */
export function SheetGrip({ peek, onPeekChange, controls }: Props) {
  const start = useRef<number | null>(null);
  const swiped = useRef(false);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    start.current = event.clientY;
    swiped.current = false;
    // Keep receiving the gesture after the finger leaves the narrow grip.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers (tests, some assistive tech) cannot be captured.
    }
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (start.current === null) return;
    const travel = event.clientY - start.current;
    start.current = null;
    if (!Number.isFinite(travel) || Math.abs(travel) < SWIPE_THRESHOLD_PX) return;
    swiped.current = true;
    onPeekChange(travel > 0);
  };

  return (
    <button
      type="button"
      className="atlas-sheet-grip"
      aria-controls={controls}
      aria-expanded={!peek}
      aria-label={peek ? "Expand the study panel" : "Lower the study panel to see the map"}
      title={peek ? "Expand the study panel" : "Show the map"}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
      }}
      onClick={() => {
        // A swipe already decided; the click that follows it is not a tap.
        if (swiped.current) {
          swiped.current = false;
          return;
        }
        onPeekChange(!peek);
      }}
    >
      <span aria-hidden="true" />
    </button>
  );
}
