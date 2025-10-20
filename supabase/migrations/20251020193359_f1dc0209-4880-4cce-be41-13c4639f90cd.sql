-- Ensure RLS is enabled on clinicas table
ALTER TABLE public.clinicas ENABLE ROW LEVEL SECURITY;

-- Add explicit authentication requirement for clinicas
CREATE POLICY "Require authentication for clinicas"
ON public.clinicas
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);