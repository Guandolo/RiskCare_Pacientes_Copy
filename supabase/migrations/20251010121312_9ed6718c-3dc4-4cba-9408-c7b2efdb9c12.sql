-- SOLUCIÓN A VULNERABILIDAD CRÍTICA: Prevenir duplicación de user_id en patient_profiles
-- y garantizar que cada usuario solo tenga UN perfil de paciente

-- 1. Agregar constraint de unicidad en user_id
ALTER TABLE public.patient_profiles 
ADD CONSTRAINT unique_user_id UNIQUE (user_id);

-- 2. Crear índice para optimizar consultas por user_id
CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id 
ON public.patient_profiles(user_id);

-- 3. Actualizar la política RLS para ser más estricta
DROP POLICY IF EXISTS "Users can view their own profile" ON public.patient_profiles;

CREATE POLICY "Users can view their own profile" 
ON public.patient_profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- 4. Actualizar política de INSERT para prevenir duplicados
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.patient_profiles;

CREATE POLICY "Users can insert their own profile" 
ON public.patient_profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND NOT EXISTS (
    SELECT 1 FROM public.patient_profiles 
    WHERE user_id = auth.uid()
  )
);