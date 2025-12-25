-- Create chat sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for sessions
CREATE POLICY "Users can view their own sessions"
    ON public.chat_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
    ON public.chat_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
    ON public.chat_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
    ON public.chat_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- Policies for messages
CREATE POLICY "Users can view messages in their sessions"
    ON public.chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_sessions
            WHERE id = chat_messages.session_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages in their sessions"
    ON public.chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_sessions
            WHERE id = chat_messages.session_id
            AND user_id = auth.uid()
        )
    );
