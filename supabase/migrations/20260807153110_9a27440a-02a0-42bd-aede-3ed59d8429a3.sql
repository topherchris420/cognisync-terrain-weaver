ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS analyses_user_id_idx ON public.analyses (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyses TO authenticated;
GRANT SELECT, INSERT ON public.analyses TO anon;
GRANT ALL ON public.analyses TO service_role;

DROP POLICY IF EXISTS "Anyone can create analyses" ON public.analyses;

CREATE POLICY "Anonymous can create unowned analyses"
  ON public.analyses FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Authenticated can create own analyses"
  ON public.analyses FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Owners can update their analyses"
  ON public.analyses FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can delete their analyses"
  ON public.analyses FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_analyses_updated_at ON public.analyses;
CREATE TRIGGER update_analyses_updated_at
  BEFORE UPDATE ON public.analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();