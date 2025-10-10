-- Create chat_feedback table for message feedback
CREATE TABLE IF NOT EXISTS public.chat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  message_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create clinical_notes_feedback table for notebook feedback
CREATE TABLE IF NOT EXISTS public.clinical_notes_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  note_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_feedback
CREATE POLICY "Users can view their own feedback"
  ON public.chat_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON public.chat_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
  ON public.chat_feedback
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
  ON public.chat_feedback
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for clinical_notes_feedback
CREATE POLICY "Users can view their own notes feedback"
  ON public.clinical_notes_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes feedback"
  ON public.clinical_notes_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes feedback"
  ON public.clinical_notes_feedback
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes feedback"
  ON public.clinical_notes_feedback
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX idx_chat_feedback_user_id ON public.chat_feedback(user_id);
CREATE INDEX idx_chat_feedback_message_id ON public.chat_feedback(message_id);
CREATE INDEX idx_clinical_notes_feedback_user_id ON public.clinical_notes_feedback(user_id);
CREATE INDEX idx_clinical_notes_feedback_note_id ON public.clinical_notes_feedback(note_id);