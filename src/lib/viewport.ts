/** Width below which the study panel is a bottom sheet rather than a docked column. */
export const SHEET_BREAKPOINT_PX = 768;

export function isSheetViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth < SHEET_BREAKPOINT_PX;
}
