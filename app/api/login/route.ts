import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, COOKIE_MAX_AGE, safeEqual, sessionToken } from "@/lib/auth";

// only same-site paths: "/x" but not "//host" or "/\host"
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return /^\/(?![/\\])/.test(next) ? next : "/";
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const next = safeNext(form.get("next"));
  const password = process.env.SITE_PASSWORD;

  const back = (error: string) => {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", error);
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  };
  if (!password) return back("config");

  const submitted = String(form.get("password") ?? "");
  const token = await sessionToken(password);
  if (!safeEqual(await sessionToken(submitted), token)) {
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing
    return back("1");
  }

  const res = NextResponse.redirect(new URL(next, request.url), 303);
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
