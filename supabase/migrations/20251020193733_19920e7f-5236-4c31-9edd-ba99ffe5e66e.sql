-- Primero, eliminar la política problemática que causa recursión
DROP POLICY IF EXISTS "Require authentication for patient profiles" ON public.patient_profiles;

-- También eliminar la política de INSERT que tiene recursión
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.patient_profiles;

-- Crear función security definer para verificar si el usuario ya tiene perfil
CREATE OR REPLACE FUNCTION public.user_has_profile(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patient_profiles
    WHERE user_id = _user_id
  )
$$;

-- Recrear la política de INSERT sin recursión usando la función
CREATE POLICY "Users can insert their own profile"
ON public.patient_profiles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND NOT public.user_has_profile(auth.uid())
);