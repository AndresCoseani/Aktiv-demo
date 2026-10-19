"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, House, LogOut, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
import { LogoBadge } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { iniciales } from "@/lib/format";
import { logout, resetDemo } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/types";

const NAV_PROFE = [
  { href: "/dashboard", label: "Dashboard", icon: House },
  { href: "/alumnos", label: "Alumnos", icon: Users },
];

const NAV_ALUMNO = [{ href: "/mi-plan", label: "Mi plan", icon: ClipboardList }];

export function Navbar({ session }: { session: Session }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = session.role === "coach" ? NAV_PROFE : NAV_ALUMNO;
  const nombreCompleto =
    session.role === "coach" ? "Lucas · Profe" : `${session.nombre} · Alumno`;

  function salir() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link
          href={items[0].href}
          className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Aktiv, ir al inicio"
        >
          <LogoBadge className="size-8" />
          <span className="hidden text-sm leading-none font-semibold tracking-tight sm:block">
            Aktiv
            <span className="mt-0.5 block text-[0.6rem] font-normal tracking-[0.2em] text-muted-foreground uppercase">
              Running
            </span>
          </span>
        </Link>

        <nav aria-label="Principal" className="ml-1 flex flex-1 items-center gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const activo = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  activo
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-[1.15rem]" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Cuenta"
              className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Avatar>
                <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                  {iniciales(session.nombre)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{nombreCompleto}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {session.role === "coach" && (
                <DropdownMenuItem
                  onClick={() => {
                    resetDemo();
                    toast.success("Datos de la demo restablecidos");
                  }}
                >
                  <RotateCcw />
                  Restablecer datos demo
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={salir}>
                <LogOut />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
