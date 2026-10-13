import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, isValidSession } from "@/lib/auth";

// Front gate: every page and API route needs the session cookie (see lib/auth.ts).
// The database layer checks it again (requireSession in lib/db.ts), so data never depends on this file alone.
export async function proxy(request: NextRequest) {
  if (await isValidSession(request.cookies.get(COOKIE)?.value)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/" || search) login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // everything except static assets and the sign-in endpoints themselves
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/login|api/logout).*)"],
};
