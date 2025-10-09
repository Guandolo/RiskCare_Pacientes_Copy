-- Crear bucket de storage para documentos clínicos
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinical-documents', 'clinical-documents', true);

-- Políticas RLS para el bucket
CREATE POLICY "Los usuarios pueden ver sus propios documentos"
ON storage.objects FOR SELECT
USING (bucket_id = 'clinical-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Los usuarios pueden subir sus propios documentos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'clinical-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Los usuarios pueden actualizar sus propios documentos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'clinical-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Los usuarios pueden eliminar sus propios documentos"
ON storage.objects FOR DELETE
USING (bucket_id = 'clinical-documents' AND auth.uid()::text = (storage.foldername(name))[1]);