import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · Renewables Browser" };

export default function LoginPage() {
  return (
    <main className="flex h-dvh items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-[15px] font-semibold tracking-tight">Spanish renewables</h1>
        <p className="mt-1 text-sm text-zinc-500">This demo is password protected.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
