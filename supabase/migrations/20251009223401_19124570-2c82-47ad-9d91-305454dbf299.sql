-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own conversations" 
ON public.conversations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations" 
ON public.conversations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" 
ON public.conversations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" 
ON public.conversations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add conversation_id to chat_messages if not exists
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;

-- Create trigger for automatic timestamp updates on conversations
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();