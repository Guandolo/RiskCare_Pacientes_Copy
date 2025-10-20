-- Crear tabla de logs de acceso a datos de pacientes
CREATE TABLE IF NOT EXISTS public.patient_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesional_user_id UUID NOT NULL,
  paciente_user_id UUID NOT NULL,
  clinica_id UUID NOT NULL,
  access_type TEXT NOT NULL, -- 'view', 'document_view', 'chat', etc.
  access_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies para logs
CREATE POLICY "SuperAdmin puede ver todos los logs"
ON public.patient_access_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admin de clínica puede ver logs de su clínica"
ON public.patient_access_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin_clinica') AND
  EXISTS (
    SELECT 1 FROM clinicas c
    WHERE c.id = patient_access_logs.clinica_id
    AND c.admin_user_id = auth.uid()
  )
);

CREATE POLICY "Profesionales pueden insertar logs"
ON public.patient_access_logs
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'profesional_clinico') AND
  auth.uid() = profesional_user_id
);

-- Crear tabla para almacenar el contexto de visualización del profesional
CREATE TABLE IF NOT EXISTS public.profesional_patient_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesional_user_id UUID NOT NULL UNIQUE,
  current_patient_user_id UUID,
  current_clinica_id UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_profesional_user FOREIGN KEY (profesional_user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.profesional_patient_context ENABLE ROW LEVEL SECURITY;

-- RLS Policies para contexto de profesional
CREATE POLICY "Profesionales pueden ver su propio contexto"
ON public.profesional_patient_context
FOR SELECT
TO authenticated
USING (auth.uid() = profesional_user_id);

CREATE POLICY "Profesionales pueden insertar su contexto"
ON public.profesional_patient_context
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = profesional_user_id);

CREATE POLICY "Profesionales pueden actualizar su contexto"
ON public.profesional_patient_context
FOR UPDATE
TO authenticated
USING (auth.uid() = profesional_user_id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_profesional_patient_context_updated_at
BEFORE UPDATE ON public.profesional_patient_context
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Agregar índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_patient_access_logs_profesional ON public.patient_access_logs(profesional_user_id);
CREATE INDEX IF NOT EXISTS idx_patient_access_logs_paciente ON public.patient_access_logs(paciente_user_id);
CREATE INDEX IF NOT EXISTS idx_patient_access_logs_clinica ON public.patient_access_logs(clinica_id);
CREATE INDEX IF NOT EXISTS idx_patient_access_logs_created_at ON public.patient_access_logs(created_at DESC);