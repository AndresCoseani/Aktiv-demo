"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { iniciarStore } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  // recupera la sesión (cookie) y carga los datos
  useEffect(() => {
    void iniciarStore();
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster position="bottom-center" />
    </ThemeProvider>
  );
}
