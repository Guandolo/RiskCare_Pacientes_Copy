-- Create table for saved clinical analysis notes
CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mapa_clinico', 'paraclinicos', 'ayudas_diagnosticas', 'medicamentos')),
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own clinical notes" 
ON public.clinical_notes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clinical notes" 
ON public.clinical_notes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clinical notes" 
ON public.clinical_notes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clinical notes" 
ON public.clinical_notes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_clinical_notes_updated_at
BEFORE UPDATE ON public.clinical_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();