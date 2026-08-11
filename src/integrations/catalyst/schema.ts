import { z } from "zod";
import type { CatalystAction, CatalystExperiment } from "./types";

export const provenanceKindSchema = z.enum([
  "measured",
  "derived",
  "simulated",
  "estimated",
  "reconstructed",
  "inferred",
  "unavailable",
]);

export const scientificStatusSchema = z.enum([
  "established",
  "experimental",
  "speculative",
]);

// Zod v4 widens tuple outputs to optional elements; the runtime check is exact,
// so the output type is pinned back to a fixed [lng, lat] pair.
const coordinateSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]) as unknown as z.ZodType<[number, number]>;

export const geoJsonGeometrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("Point"),
    coordinates: coordinateSchema,
  }),
  z.object({
    type: z.literal("LineString"),
    coordinates: z.array(coordinateSchema).min(2),
  }),
  z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(coordinateSchema).min(4)).min(1),
  }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(z.array(coordinateSchema).min(4)).min(1)).min(1),
  }),
]);

const catalystActionUnion = z.discriminatedUnion("type", [
    z.object({
      type: z.literal("scenario"),
      intervention: z.enum([
        "tree_canopy",
        "bioswale",
        "permeable_pavement",
        "green_roof",
      ]),
      fraction: z.number().finite().min(0).max(1),
      geometry: geoJsonGeometrySchema.optional(),
    }),
    z.object({
      type: z.literal("hydrology"),
      rainfallMm: z.number().finite().min(1).max(500),
      resolution: z.enum(["low", "medium", "high"]).optional(),
    }),
    z.object({
      type: z.literal("comparison"),
      variants: z
        .array(
          z.object({
            id: z.string().min(1).max(80),
            label: z.string().min(1).max(120),
            intervention: z.enum([
              "tree_canopy",
              "bioswale",
              "permeable_pavement",
              "green_roof",
            ]),
            fraction: z.number().finite().min(0).max(1),
            projectedScore: z.number().finite().min(0).max(100).optional(),
            addedRetentionM3: z.number().finite().min(0).optional(),
            cost: z.number().finite().min(0).optional(),
          })
        )
        .min(1)
        .max(8),
    }),
    z.object({
      type: z.literal("custom"),
      executable: z.literal(false),
      description: z.string().min(1).max(2000),
    }),
  ]);

// Runtime validation is exact; the declared output is pinned to the domain type
// because Zod v4 widens tuple/array element types.
export const catalystActionSchema =
  catalystActionUnion as unknown as z.ZodType<CatalystAction>;

export const catalystExperimentSchema: z.ZodType<CatalystExperiment> = z.object({
  id: z.string().regex(/^MNH-CF-\d{4,}$/),
  hypothesis: z.string().min(1).max(2000),
  objective: z.string().min(1).max(1000),
  scientificStatus: scientificStatusSchema,
  assumptions: z.array(z.string().min(1).max(1000)).max(20),
  claims: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        statement: z.string().min(1).max(1000),
        status: scientificStatusSchema,
        evidenceNeeded: z.array(z.string().min(1).max(500)).max(10).optional(),
      })
    )
    .max(20),
  variables: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        role: z.enum(["independent", "dependent", "control"]),
        unit: z.string().min(1).max(40).optional(),
      })
    )
    .max(20),
  methodology: z.array(z.string().min(1).max(1000)).max(20),
  successCriteria: z.array(z.string().min(1).max(1000)).max(12),
  falsificationCriteria: z.array(z.string().min(1).max(1000)).max(12),
  limitations: z.array(z.string().min(1).max(1000)).max(20),
  requiredData: z.array(z.string().min(1).max(300)).max(20),
  actions: z.array(catalystActionSchema).max(12),
  executionStatus: z.enum([
    "draft",
    "partially-executable",
    "executable",
    "running",
    "completed",
  ]),
  verification: z
    .object({
      score: z.number().finite().min(0).max(100).optional(),
      warnings: z.array(z.string().min(1).max(1000)).max(20),
    })
    .optional(),
});

export function parseCatalystExperiment(raw: unknown): CatalystExperiment {
  return catalystExperimentSchema.parse(raw);
}
