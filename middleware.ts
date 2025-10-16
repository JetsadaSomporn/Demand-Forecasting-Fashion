import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Skip logging for static files
  const shouldLog = !path.startsWith("/api/") && 
                    !path.startsWith("/_next/") &&
                    !path.match(/\.(jpg|jpeg|png|gif|svg|webp|mp4)$/);

  // Only process if Supabase is configured
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (shouldLog) console.log("[Middleware] ⚠️ Supabase not configured");
    return NextResponse.next();
  }

  // Log incoming cookies
  const incomingCookies = request.cookies.getAll();
  const supabaseCookies = incomingCookies.filter(c => c.name.startsWith('sb-'));
  
  if (shouldLog) {
    console.log("[Middleware] 📥 Incoming cookies:", {
      path,
      totalCookies: incomingCookies.length,
      supabaseCookies: supabaseCookies.length,
      cookieNames: supabaseCookies.map(c => c.name),
    });
  }

  // Create a fresh response
  let supabaseResponse = NextResponse.next({
    request,
  });

  let cookiesSetCount = 0;

  // Create Supabase client with cookie handling
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        if (shouldLog) {
          console.log("[Middleware] 🍪 Setting cookies:", {
            count: cookiesToSet.length,
            names: cookiesToSet.map(c => c.name),
          });
        }
        
        // Update both request and response cookies
        cookiesToSet.forEach(({ name, value, options }) => {
          cookiesSetCount++;
          
          // Force proper cookie options for production
          const finalOptions = {
            ...options,
            path: '/',
            maxAge: options?.maxAge || 60 * 60 * 24 * 7, // 7 days default
            sameSite: 'lax' as const,
            secure: true, // Always secure for Vercel
            httpOnly: options?.httpOnly ?? true,
            domain: undefined, // Let browser set it automatically
          };
          
          request.cookies.set(name, value);
          supabaseResponse.cookies.set(name, value, finalOptions);
          
          if (shouldLog) {
            console.log("[Middleware] 🍪 Set cookie:", {
              name,
              valueLength: value?.length || 0,
              options: finalOptions,
            });
          }
        });
      },
    },
  });

  // Refresh session if expired - required for Server Components
  // Use getUser() instead of getSession() to force token refresh
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Log outgoing cookies
  if (shouldLog) {
    const outgoingCookies = supabaseResponse.cookies.getAll();
    console.log("[Middleware] 📤 Response:", {
      path,
      hasUser: !!user,
      userId: user?.id,
      error: error?.message,
      cookiesSet: cookiesSetCount,
      outgoingCookies: outgoingCookies.length,
      outgoingNames: outgoingCookies.map(c => c.name),
    });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to fit your needs
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
