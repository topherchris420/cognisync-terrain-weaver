-- Create simulation_cache table for caching hydrological runoff simulation results
-- Caches results for 24 hours to improve performance

CREATE TABLE IF NOT EXISTS public.simulation_cache (
  id SERIAL PRIMARY KEY,
  bbox_north NUMERIC NOT NULL,
  bbox_south NUMERIC NOT NULL,
  bbox_east NUMERIC NOT NULL,
  bbox_west NUMERIC NOT NULL,
  rainfall_mm NUMERIC NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT ON public.simulation_cache TO anon, authenticated;
GRANT ALL ON public.simulation_cache TO service_role;

-- Enable RLS
ALTER TABLE public.simulation_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies (anyone can read, only service role can write)
CREATE POLICY "Anyone can view simulation cache" ON public.simulation_cache
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert simulation cache" ON public.simulation_cache
  FOR INSERT WITH CHECK (true);

-- Create index for efficient cache lookups
CREATE INDEX idx_simulation_cache_lookup
ON public.simulation_cache (bbox_north, bbox_south, bbox_east, bbox_west, rainfall_mm);

-- Create index for cleanup queries
CREATE INDEX idx_simulation_cache_created_at ON public.simulation_cache (created_at DESC);