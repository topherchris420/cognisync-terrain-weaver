-- Counterfactual hydrology results are comparable only when storm, surface,
-- and model identities all match. Legacy rows intentionally keep null identity
-- columns and therefore cannot satisfy the V2 lookup.

ALTER TABLE public.simulation_cache
  ADD COLUMN IF NOT EXISTS storm_hash TEXT,
  ADD COLUMN IF NOT EXISTS surface_hash TEXT,
  ADD COLUMN IF NOT EXISTS model_version TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

UPDATE public.simulation_cache
SET expires_at = created_at + INTERVAL '24 hours'
WHERE expires_at IS NULL;

ALTER TABLE public.simulation_cache
  ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '24 hours');

CREATE INDEX IF NOT EXISTS simulation_cache_counterfactual_lookup
  ON public.simulation_cache (
    storm_hash,
    surface_hash,
    model_version,
    expires_at
  )
  WHERE storm_hash IS NOT NULL
    AND surface_hash IS NOT NULL
    AND model_version IS NOT NULL;

CREATE INDEX IF NOT EXISTS simulation_cache_counterfactual_bbox
  ON public.simulation_cache (
    bbox_north,
    bbox_south,
    bbox_east,
    bbox_west,
    storm_hash,
    surface_hash,
    model_version
  )
  WHERE storm_hash IS NOT NULL
    AND surface_hash IS NOT NULL
    AND model_version IS NOT NULL;
