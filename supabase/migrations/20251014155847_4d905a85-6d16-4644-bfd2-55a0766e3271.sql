-- Agregar campo de estado de procesamiento a clinical_documents
ALTER TABLE public.clinical_documents 
ADD COLUMN processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));

-- Agregar campo para mensaje de error si falla el procesamiento
ALTER TABLE public.clinical_documents 
ADD COLUMN processing_error text;

-- Crear índice para consultas por estado
CREATE INDEX idx_clinical_documents_processing_status 
ON public.clinical_documents(processing_status, created_at DESC);

-- Comentar columnas para documentación
COMMENT ON COLUMN public.clinical_documents.processing_status IS 'Estado del procesamiento: pending (pendiente), processing (procesando), completed (completado), failed (fallido)';
COMMENT ON COLUMN public.clinical_documents.processing_error IS 'Mensaje de error si el procesamiento falla';