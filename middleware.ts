import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function middleware(request: NextRequest) {
  // Create a response object
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Only process if Supabase is configured
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return response;
  }

  // Create Supabase client with cookie handling
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          // Ensure proper cookie options for production
          const cookieOptions = {
            ...cookie.options,
            sameSite: 'lax' as const,
            secure: process.env.NODE_ENV === 'production',
          };
          
          response.cookies.set({
            name: cookie.name,
            value: cookie.value,
            ...cookieOptions,
          });
        }
      },
    },
  });

  // Refresh session if expired - required for Server Components
  // Use getUser() instead of getSession() to force token refresh
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Optional: Add logging for debugging
  if (request.nextUrl.pathname.startsWith("/api/") || 
      request.nextUrl.pathname.startsWith("/_next/")) {
    // Skip logging for API routes and Next.js internal routes
  } else {
    console.log("[Middleware]", {
      path: request.nextUrl.pathname,
      hasUser: !!user,
      userId: user?.id,
      error: error?.message,
    });
  }

  return response;
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
