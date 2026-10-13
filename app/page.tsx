import { Suspense } from "react";
import Browser from "@/components/Browser";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center text-sm text-zinc-500">Loading…</div>}>
      <Browser />
    </Suspense>
  );
}
