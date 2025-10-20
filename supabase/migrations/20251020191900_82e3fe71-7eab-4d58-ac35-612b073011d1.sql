-- Crear enum para roles de aplicación
CREATE TYPE public.app_role AS ENUM ('paciente', 'profesional_clinico', 'admin_clinica', 'superadmin');

-- Tabla de roles de usuario (CRITICAL: separada de profiles para seguridad)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Tabla de clínicas/IPS
CREATE TABLE public.clinicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  nit TEXT UNIQUE,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  admin_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de profesionales clínicos validados
CREATE TABLE public.profesionales_clinicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  tipo_documento TEXT NOT NULL,
  numero_documento TEXT NOT NULL,
  rethus_data JSONB,
  estado_validacion TEXT DEFAULT 'pendiente',
  fecha_validacion TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de asociación clínica-profesional
CREATE TABLE public.clinica_profesionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  profesional_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (clinica_id, profesional_user_id)
);

-- Tabla de asignación clínica-paciente
CREATE TABLE public.clinica_pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_user_id UUID NOT NULL,
  profesional_asignado_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (clinica_id, paciente_user_id)
);

-- Función security definer para verificar roles (evita recursión RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Función para verificar si usuario tiene cualquiera de múltiples roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

-- Trigger para actualizar updated_at en clínicas
CREATE TRIGGER update_clinicas_updated_at
BEFORE UPDATE ON public.clinicas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profesionales_clinicos_updated_at
BEFORE UPDATE ON public.profesionales_clinicos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "SuperAdmin can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'));

-- RLS para clinicas
ALTER TABLE public.clinicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins de clínica pueden ver su clínica"
ON public.clinicas FOR SELECT
USING (
  auth.uid() = admin_user_id OR
  public.has_role(auth.uid(), 'superadmin')
);

CREATE POLICY "SuperAdmin puede gestionar clínicas"
ON public.clinicas FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admin de clínica puede actualizar su clínica"
ON public.clinicas FOR UPDATE
USING (auth.uid() = admin_user_id);

-- RLS para profesionales_clinicos
ALTER TABLE public.profesionales_clinicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profesionales pueden ver su propio registro"
ON public.profesionales_clinicos FOR SELECT
USING (
  auth.uid() = user_id OR
  public.has_role(auth.uid(), 'superadmin')
);

CREATE POLICY "Usuarios pueden crear su registro de profesional"
ON public.profesionales_clinicos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Profesionales pueden actualizar su registro"
ON public.profesionales_clinicos FOR UPDATE
USING (auth.uid() = user_id);

-- RLS para clinica_profesionales
ALTER TABLE public.clinica_profesionales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profesionales pueden ver sus clínicas"
ON public.clinica_profesionales FOR SELECT
USING (
  auth.uid() = profesional_user_id OR
  public.has_role(auth.uid(), 'superadmin') OR
  EXISTS (
    SELECT 1 FROM public.clinicas c
    WHERE c.id = clinica_id AND c.admin_user_id = auth.uid()
  )
);

CREATE POLICY "Admin de clínica puede gestionar profesionales"
ON public.clinica_profesionales FOR ALL
USING (
  public.has_role(auth.uid(), 'superadmin') OR
  EXISTS (
    SELECT 1 FROM public.clinicas c
    WHERE c.id = clinica_id AND c.admin_user_id = auth.uid()
  )
);

-- RLS para clinica_pacientes
ALTER TABLE public.clinica_pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pacientes pueden ver sus clínicas"
ON public.clinica_pacientes FOR SELECT
USING (
  auth.uid() = paciente_user_id OR
  auth.uid() = profesional_asignado_user_id OR
  public.has_role(auth.uid(), 'superadmin') OR
  EXISTS (
    SELECT 1 FROM public.clinicas c
    WHERE c.id = clinica_id AND c.admin_user_id = auth.uid()
  )
);

CREATE POLICY "Admin de clínica puede gestionar pacientes"
ON public.clinica_pacientes FOR ALL
USING (
  public.has_role(auth.uid(), 'superadmin') OR
  EXISTS (
    SELECT 1 FROM public.clinicas c
    WHERE c.id = clinica_id AND c.admin_user_id = auth.uid()
  )
);

-- Asignar rol de paciente a todos los usuarios existentes
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'paciente'::app_role
FROM public.patient_profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = patient_profiles.user_id
);

-- Asignar rol de superadmin al usuario jeisonperez@ingenieria365.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'superadmin'::app_role
FROM auth.users
WHERE email = 'jeisonperez@ingenieria365.com'
ON CONFLICT (user_id, role) DO NOTHING;