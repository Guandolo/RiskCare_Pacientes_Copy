-- Actualizar RLS policies para permitir a profesionales clínicos ver datos de pacientes asignados

-- Política para que profesionales vean perfiles de pacientes asignados a su clínica
DROP POLICY IF EXISTS "Profesionales pueden ver pacientes asignados" ON public.patient_profiles;
CREATE POLICY "Profesionales pueden ver pacientes asignados"
ON public.patient_profiles FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.clinica_pacientes cp
    INNER JOIN public.clinica_profesionales cpf ON cp.clinica_id = cpf.clinica_id
    WHERE cp.paciente_user_id = patient_profiles.user_id
    AND cpf.profesional_user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.clinica_pacientes cp
    WHERE cp.paciente_user_id = patient_profiles.user_id
    AND cp.profesional_asignado_user_id = auth.uid()
  )
);

-- Política para que profesionales vean documentos clínicos de pacientes asignados
DROP POLICY IF EXISTS "Profesionales pueden ver documentos de pacientes asignados" ON public.clinical_documents;
CREATE POLICY "Profesionales pueden ver documentos de pacientes asignados"
ON public.clinical_documents FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.clinica_pacientes cp
    INNER JOIN public.clinica_profesionales cpf ON cp.clinica_id = cpf.clinica_id
    WHERE cp.paciente_user_id = clinical_documents.user_id
    AND cpf.profesional_user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.clinica_pacientes cp
    WHERE cp.paciente_user_id = clinical_documents.user_id
    AND cp.profesional_asignado_user_id = auth.uid()
  )
);

-- Política para que profesionales vean mensajes de chat de pacientes asignados
DROP POLICY IF EXISTS "Profesionales pueden ver mensajes de pacientes asignados" ON public.chat_messages;
CREATE POLICY "Profesionales pueden ver mensajes de pacientes asignados"
ON public.chat_messages FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.clinica_pacientes cp
    INNER JOIN public.clinica_profesionales cpf ON cp.clinica_id = cpf.clinica_id
    WHERE cp.paciente_user_id = chat_messages.user_id
    AND cpf.profesional_user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.clinica_pacientes cp
    WHERE cp.paciente_user_id = chat_messages.user_id
    AND cp.profesional_asignado_user_id = auth.uid()
  )
);