-- Agregar campo para historial de validaciones en profesionales_clinicos
ALTER TABLE public.profesionales_clinicos 
ADD COLUMN IF NOT EXISTS historial_validaciones jsonb DEFAULT '[]'::jsonb;

-- Agregar comentario explicativo
COMMENT ON COLUMN public.profesionales_clinicos.historial_validaciones IS 'Historial de todas las validaciones RETHUS realizadas por el profesional';