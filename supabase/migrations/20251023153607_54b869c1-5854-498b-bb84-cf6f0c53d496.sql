-- Crear tabla para tokens de acceso compartido 
CREATE TABLE IF NOT EXISTS public.shared_access_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  permissions JSONB NOT NULL DEFAULT '{"allow_download": false, "allow_chat": false, "allow_notebook": false}'::jsonb,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

-- Habilitar RLS (idempotente)
ALTER TABLE public.shared_access_tokens ENABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX IF NOT EXISTS idx_shared_access_tokens_patient_user_id
  ON public.shared_access_tokens(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_access_tokens_token
  ON public.shared_access_tokens(token) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shared_access_tokens_expires_at
  ON public.shared_access_tokens(expires_at) WHERE revoked_at IS NULL;

-- Políticas RLS (DROP IF EXISTS + CREATE)

DROP POLICY IF EXISTS "Users can view their own shared access tokens"
  ON public.shared_access_tokens;
CREATE POLICY "Users can view their own shared access tokens"
ON public.shared_access_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = patient_user_id);

DROP POLICY IF EXISTS "Users can create their own shared access tokens"
  ON public.shared_access_tokens;
CREATE POLICY "Users can create their own shared access tokens"
ON public.shared_access_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = patient_user_id);

DROP POLICY IF EXISTS "Users can update their own shared access tokens"
  ON public.shared_access_tokens;
CREATE POLICY "Users can update their own shared access tokens"
ON public.shared_access_tokens
FOR UPDATE
TO authenticated
USING (auth.uid() = patient_user_id);

DROP POLICY IF EXISTS "Users can delete their own shared access tokens"
  ON public.shared_access_tokens;
CREATE POLICY "Users can delete their own shared access tokens"
ON public.shared_access_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = patient_user_id);

-- Crear tabla de auditoría para accesos de invitados
CREATE TABLE IF NOT EXISTS public.guest_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES public.shared_access_tokens(id) ON DELETE CASCADE,
  patient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  action_type TEXT NOT NULL,
  action_details JSONB
);

-- Habilitar RLS
ALTER TABLE public.guest_access_logs ENABLE ROW LEVEL SECURITY;

-- Índices auditoría
CREATE INDEX IF NOT EXISTS idx_guest_access_logs_token_id
  ON public.guest_access_logs(token_id);
CREATE INDEX IF NOT EXISTS idx_guest_access_logs_patient_user_id
  ON public.guest_access_logs(patient_user_id);

-- Policy RLS auditoría
DROP POLICY IF EXISTS "Users can view their own guest access logs"
  ON public.guest_access_logs;
CREATE POLICY "Users can view their own guest access logs"
ON public.guest_access_logs
FOR SELECT
TO authenticated
USING (auth.uid() = patient_user_id);

-- Función para limpiar tokens expirados automáticamente
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.shared_access_tokens
  WHERE expires_at < now() AND revoked_at IS NULL;
END;
$$;
