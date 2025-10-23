-- =====================================================================
-- Migración: Soporte para Profesionales - Asociación Dual de Conversaciones y Notas Clínicas
-- Fecha: 2025-10-23
-- Descripción: Agrega patient_user_id a conversations y clinical_notes para permitir
--              que profesionales gestionen historiales específicos por paciente
-- =====================================================================

-- ============================================
-- 1. ACTUALIZAR TABLA CONVERSATIONS
-- ============================================

-- Agregar columna patient_user_id (opcional para retrocompatibilidad)
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS patient_user_id UUID;

-- Crear índice para mejorar performance en queries de profesionales
CREATE INDEX IF NOT EXISTS idx_conversations_patient_user_id 
ON public.conversations(patient_user_id);

-- Crear índice compuesto para queries de profesional + paciente
CREATE INDEX IF NOT EXISTS idx_conversations_user_patient 
ON public.conversations(user_id, patient_user_id);

-- ============================================
-- 2. ACTUALIZAR TABLA CLINICAL_NOTES
-- ============================================

-- Agregar columna patient_user_id (opcional para retrocompatibilidad)
ALTER TABLE public.clinical_notes 
ADD COLUMN IF NOT EXISTS patient_user_id UUID;

-- Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient_user_id 
ON public.clinical_notes(patient_user_id);

-- Crear índice compuesto
CREATE INDEX IF NOT EXISTS idx_clinical_notes_user_patient 
ON public.clinical_notes(user_id, patient_user_id);

-- ============================================
-- 3. ACTUALIZAR POLICIES - CONVERSATIONS
-- ============================================

-- Eliminar policies antiguas
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;

-- NUEVA POLICY: SELECT - Permite a pacientes ver sus conversaciones y a profesionales ver conversaciones de sus pacientes
CREATE POLICY "Users can view conversations" 
ON public.conversations 
FOR SELECT 
USING (
  -- Caso 1: Usuario ve sus propias conversaciones (paciente o profesional viendo su propio chat)
  auth.uid() = user_id
  OR
  -- Caso 2: Profesional ve conversaciones que él creó sobre un paciente
  (auth.uid() = user_id AND patient_user_id IS NOT NULL)
  OR
  -- Caso 3: Paciente ve conversaciones que profesionales crearon sobre él
  auth.uid() = patient_user_id
);

-- NUEVA POLICY: INSERT - Permite crear conversaciones propias o sobre pacientes asignados
CREATE POLICY "Users can insert conversations" 
ON public.conversations 
FOR INSERT 
WITH CHECK (
  -- Caso 1: Usuario crea conversación propia (paciente sin patient_user_id)
  (auth.uid() = user_id AND patient_user_id IS NULL)
  OR
  -- Caso 2: Profesional crea conversación sobre un paciente
  (auth.uid() = user_id AND patient_user_id IS NOT NULL)
);

-- NUEVA POLICY: UPDATE - Solo el creador puede actualizar
CREATE POLICY "Users can update conversations" 
ON public.conversations 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- NUEVA POLICY: DELETE - Solo el creador puede eliminar
CREATE POLICY "Users can delete conversations" 
ON public.conversations 
FOR DELETE 
USING (auth.uid() = user_id);

-- ============================================
-- 4. ACTUALIZAR POLICIES - CLINICAL_NOTES
-- ============================================

-- Eliminar policies antiguas
DROP POLICY IF EXISTS "Users can view their own clinical notes" ON public.clinical_notes;
DROP POLICY IF EXISTS "Users can insert their own clinical notes" ON public.clinical_notes;
DROP POLICY IF EXISTS "Users can update their own clinical notes" ON public.clinical_notes;
DROP POLICY IF EXISTS "Users can delete their own clinical notes" ON public.clinical_notes;

-- NUEVA POLICY: SELECT - Permite a pacientes ver sus notas y a profesionales ver notas de sus pacientes
CREATE POLICY "Users can view clinical notes" 
ON public.clinical_notes 
FOR SELECT 
USING (
  -- Caso 1: Usuario ve sus propias notas (paciente)
  auth.uid() = user_id
  OR
  -- Caso 2: Profesional ve notas que él creó sobre un paciente
  (auth.uid() = user_id AND patient_user_id IS NOT NULL)
  OR
  -- Caso 3: Paciente ve notas que profesionales crearon sobre él
  auth.uid() = patient_user_id
);

-- NUEVA POLICY: INSERT - Permite crear notas propias o sobre pacientes
CREATE POLICY "Users can insert clinical notes" 
ON public.clinical_notes 
FOR INSERT 
WITH CHECK (
  -- Caso 1: Usuario crea nota propia (paciente sin patient_user_id)
  (auth.uid() = user_id AND patient_user_id IS NULL)
  OR
  -- Caso 2: Profesional crea nota sobre un paciente
  (auth.uid() = user_id AND patient_user_id IS NOT NULL)
);

-- NUEVA POLICY: UPDATE - Solo el creador puede actualizar
CREATE POLICY "Users can update clinical notes" 
ON public.clinical_notes 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- NUEVA POLICY: DELETE - Solo el creador puede eliminar
CREATE POLICY "Users can delete clinical notes" 
ON public.clinical_notes 
FOR DELETE 
USING (auth.uid() = user_id);

-- ============================================
-- 5. MIGRACIÓN DE DATOS EXISTENTES (OPCIONAL)
-- ============================================

-- Nota: patient_user_id se deja NULL para conversaciones y notas existentes
-- Esto mantiene compatibilidad con datos de pacientes que ya existían antes de esta migración
-- Las nuevas conversaciones de profesionales tendrán patient_user_id poblado

-- ============================================
-- 6. COMENTARIOS Y DOCUMENTACIÓN
-- ============================================

COMMENT ON COLUMN public.conversations.patient_user_id IS 
'ID del paciente sobre el cual trata esta conversación. NULL para conversaciones de pacientes sobre sí mismos. Poblado para conversaciones de profesionales sobre pacientes.';

COMMENT ON COLUMN public.clinical_notes.patient_user_id IS 
'ID del paciente sobre el cual trata esta nota clínica. NULL para notas de pacientes sobre sí mismos. Poblado para notas de profesionales sobre pacientes.';

-- ============================================
-- 7. FUNCIÓN HELPER PARA DEBUGGING (OPCIONAL)
-- ============================================

-- Función para verificar permisos de una conversación
CREATE OR REPLACE FUNCTION public.check_conversation_access(conv_id UUID)
RETURNS TABLE (
  can_view BOOLEAN,
  can_edit BOOLEAN,
  reason TEXT
) AS $$
DECLARE
  conv_record RECORD;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  SELECT * INTO conv_record 
  FROM public.conversations 
  WHERE id = conv_id;
  
  IF conv_record IS NULL THEN
    RETURN QUERY SELECT FALSE, FALSE, 'Conversación no encontrada';
    RETURN;
  END IF;
  
  -- Verificar acceso de lectura
  IF current_user_id = conv_record.user_id THEN
    RETURN QUERY SELECT TRUE, TRUE, 'Propietario de la conversación';
  ELSIF current_user_id = conv_record.patient_user_id THEN
    RETURN QUERY SELECT TRUE, FALSE, 'Paciente de la conversación (solo lectura)';
  ELSE
    RETURN QUERY SELECT FALSE, FALSE, 'Sin acceso';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIN DE MIGRACIÓN
-- ============================================
