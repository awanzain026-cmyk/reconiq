import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// All routes except /login and /signup require real auth -- this is
// financial data, there is no anonymous-access mode like NexDesk's chat.
const PUBLIC_PATHS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p)) || path.startsWith("/api/diagnostics");

  if (isPublic) {
    return NextResponse.next();
  }

  const redirectToLogin = () => {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", path);
    return NextResponse.redirect(redirectUrl);
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // Fail SAFE, not fail OPEN: if env vars are missing, redirect to
  // login rather than crash the whole request (learned the hard way).
  if (!supabaseUrl || !supabaseKey) {
    console.error("[proxy] Supabase env vars missing -- failing safe to /login");
    return redirectToLogin();
  }

  try {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return redirectToLogin();
    }

    return response;
  } catch (err) {
    console.error("[proxy] Unexpected error checking auth -- failing safe to /login:", err);
    return redirectToLogin();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
