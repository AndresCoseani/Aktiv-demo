"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { Navbar } from "@/components/navbar";
import { useHydrated, useStore } from "@/lib/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { session, listo } = useStore();

  useEffect(() => {
    if (hydrated && listo && !session) router.replace("/login");
  }, [hydrated, listo, session, router]);

  if (!hydrated || !listo || !session) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <LogoMark className="size-10 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Navbar session={session} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </>
  );
}
