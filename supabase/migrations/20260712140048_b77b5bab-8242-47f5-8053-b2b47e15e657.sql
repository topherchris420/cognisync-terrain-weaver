
DROP POLICY IF EXISTS "Anyone can update analyses" ON public.analyses;
DROP POLICY IF EXISTS "Anyone can delete analyses" ON public.analyses;

REVOKE UPDATE, DELETE ON public.analyses FROM anon, authenticated;
