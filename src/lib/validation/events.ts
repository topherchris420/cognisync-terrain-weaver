/**
 * Pluvial events and outcome definitions fixed in
 * experiments/PREREGISTRATION.md before outcome data were fetched.
 * Windows are NYC local time, as 311 `created_date` is recorded.
 */
export interface ValidationEvent {
  id: string;
  label: string;
  start: string;
  end: string;
  role: "development" | "holdout";
}

export const EVENTS: ValidationEvent[] = [
  { id: "2021-08-henri", label: "Tropical Storm Henri", start: "2021-08-21T12:00:00", end: "2021-08-23T00:00:00", role: "development" },
  { id: "2021-09-ida", label: "Remnants of Hurricane Ida", start: "2021-09-01T18:00:00", end: "2021-09-02T12:00:00", role: "development" },
  { id: "2023-09-29", label: "29 September 2023 storm", start: "2023-09-29T00:00:00", end: "2023-09-30T06:00:00", role: "holdout" },
];

/** Primary outcome: surface street flooding. */
export const PRIMARY_DESCRIPTOR = "Street Flooding (SJ)";
/** Sensitivity outcome adds clogged/flooding catch basins. */
export const SENSITIVITY_DESCRIPTOR = "Catch Basin Clogged/Flooding (Use Comments) (SC)";
export const OUTCOME_DESCRIPTORS = [PRIMARY_DESCRIPTOR, SENSITIVITY_DESCRIPTOR] as const;
