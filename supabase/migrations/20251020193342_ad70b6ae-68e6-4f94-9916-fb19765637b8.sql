-- Ensure RLS is enabled on patient_profiles
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

-- Add explicit authentication requirement for all operations
-- This ensures unauthenticated users cannot access any data
CREATE POLICY "Require authentication for patient profiles"
ON public.patient_profiles
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);