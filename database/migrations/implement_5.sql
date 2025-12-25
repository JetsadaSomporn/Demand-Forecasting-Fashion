-- Add use_memory column to settings table
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS use_memory BOOLEAN DEFAULT TRUE;
