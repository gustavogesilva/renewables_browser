"use client";

import { useSearchParams } from "next/navigation";

const ERRORS: Record<string, string> = {
  "1": "Wrong password.",
  config: "No site password is configured (SITE_PASSWORD).",
};

// A plain form: the browser posts it to /api/login, which sets the session cookie and redirects back.
export default function LoginForm() {
  const sp = useSearchParams();
  const error = ERRORS[sp.get("error") ?? ""];
  return (
    <form method="post" action="/api/login" className="mt-5 flex flex-col gap-3">
      <input type="hidden" name="next" value={sp.get("next") ?? "/"} />
      <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Password
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          className="h-9 rounded-md border border-zinc-300 px-2.5 text-sm normal-case tracking-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" className="h-9 rounded-md bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700">
        Enter
      </button>
    </form>
  );
}
