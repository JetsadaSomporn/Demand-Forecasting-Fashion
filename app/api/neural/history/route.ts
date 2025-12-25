import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json([]);
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
        // Get messages for specific session
        const { data } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });
        
        return NextResponse.json(data || []);
    } else {
        // Get list of sessions
        const { data } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });
            
        return NextResponse.json(data || []);
    }
}
