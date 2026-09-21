
CREATE TABLE public.analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location_label TEXT,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  zoom DOUBLE PRECISION NOT NULL,
  bbox JSONB,
  image_data_url TEXT,
  land_cover JSONB NOT NULL DEFAULT '{}'::jsonb,
  absorption_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  flood_risk TEXT NOT NULL DEFAULT 'unknown',
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_notes TEXT,
  status TEXT NOT NULL DEFAULT 'complete',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyses TO anon, authenticated;
GRANT ALL ON public.analyses TO service_role;

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view analyses" ON public.analyses
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create analyses" ON public.analyses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update analyses" ON public.analyses
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete analyses" ON public.analyses
  FOR DELETE USING (true);

CREATE INDEX analyses_created_at_idx ON public.analyses (created_at DESC);
