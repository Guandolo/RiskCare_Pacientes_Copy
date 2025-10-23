-- Eliminar la política demasiado permisiva que permite a cualquier usuario autenticado ver todas las clínicas
DROP POLICY IF EXISTS "Require authentication for clinicas" ON public.clinicas;

-- Crear política específica para profesionales: solo pueden ver clínicas a las que están asignados
CREATE POLICY "Profesionales pueden ver sus clínicas asignadas"
ON public.clinicas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.clinica_profesionales cp
    WHERE cp.clinica_id = clinicas.id 
    AND cp.profesional_user_id = auth.uid()
  )
);

-- Crear política específica para pacientes: solo pueden ver clínicas a las que están asignados
CREATE POLICY "Pacientes pueden ver sus clínicas asignadas"
ON public.clinicas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.clinica_pacientes cp
    WHERE cp.clinica_id = clinicas.id 
    AND cp.paciente_user_id = auth.uid()
  )
);