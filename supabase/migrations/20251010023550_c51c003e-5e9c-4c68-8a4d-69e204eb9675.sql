-- Eliminar el constraint anterior
ALTER TABLE public.clinical_notes DROP CONSTRAINT IF EXISTS clinical_notes_type_check;

-- Crear nuevo constraint que incluya 'analisis_corporal'
ALTER TABLE public.clinical_notes 
ADD CONSTRAINT clinical_notes_type_check 
CHECK (type IN ('mapa_clinico', 'paraclinicos', 'ayudas_diagnosticas', 'medicamentos', 'analisis_corporal'));