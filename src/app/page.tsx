"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { useHydrated, useStore } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { session } = useStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!session) router.replace("/login");
    else router.replace(session.role === "coach" ? "/dashboard" : "/mi-plan");
  }, [hydrated, session, router]);

  return (
    <div className="grid min-h-dvh place-items-center">
      <LogoMark className="size-10 animate-pulse text-muted-foreground" />
    </div>
  );
}
