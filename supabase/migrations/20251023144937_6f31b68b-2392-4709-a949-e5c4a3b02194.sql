-- Eliminar las políticas que causan recursión infinita
DROP POLICY IF EXISTS "Profesionales pueden ver sus clínicas asignadas" ON public.clinicas;
DROP POLICY IF EXISTS "Pacientes pueden ver sus clínicas asignadas" ON public.clinicas;

-- Crear funciones security definer para evitar recursión en RLS
CREATE OR REPLACE FUNCTION public.user_can_view_clinica(_user_id uuid, _clinica_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- El usuario puede ver la clínica si:
  -- 1. Es profesional asignado a la clínica
  -- 2. Es paciente asignado a la clínica
  -- 3. Es el admin de la clínica
  -- 4. Es superadmin
  SELECT EXISTS (
    SELECT 1 FROM public.clinica_profesionales cp
    WHERE cp.clinica_id = _clinica_id AND cp.profesional_user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.clinica_pacientes cp
    WHERE cp.clinica_id = _clinica_id AND cp.paciente_user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.clinicas c
    WHERE c.id = _clinica_id AND c.admin_user_id = _user_id
  )
  OR has_role(_user_id, 'superadmin'::app_role);
$$;

-- Recrear políticas usando la función security definer
CREATE POLICY "Usuarios pueden ver clínicas asignadas"
ON public.clinicas
FOR SELECT
TO authenticated
USING (
  public.user_can_view_clinica(auth.uid(), id)
);