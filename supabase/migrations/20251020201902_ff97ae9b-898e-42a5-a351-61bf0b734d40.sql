-- Agregar política para que SuperAdmins puedan ver todos los perfiles de pacientes
CREATE POLICY "SuperAdmins pueden ver todos los perfiles"
ON public.patient_profiles
FOR SELECT
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Agregar política para que Admin de clínica pueda ver perfiles de pacientes de su clínica
CREATE POLICY "Admin de clínica puede ver pacientes de su clínica"
ON public.patient_profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin_clinica'::app_role) 
  AND EXISTS (
    SELECT 1 FROM clinica_pacientes cp
    JOIN clinicas c ON c.id = cp.clinica_id
    WHERE c.admin_user_id = auth.uid()
    AND cp.paciente_user_id = patient_profiles.user_id
  )
);