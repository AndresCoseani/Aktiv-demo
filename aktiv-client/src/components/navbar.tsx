"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  BookOpen,
  CalendarDays,
  Dumbbell,
  FileCheck2,
  Flag,
  HeartPulse,
  House,
  KeyRound,
  LogOut,
  Menu,
  Timer,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CambiarClaveDialog } from "@/components/cambiar-clave";
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
import { logout } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/types";

const NAV_PROFE = [
  { href: "/dashboard", label: "Dashboard", icon: House },
  { href: "/agenda", label: "Clases", icon: CalendarDays },
  { href: "/alumnos", label: "Alumnos", icon: Users },
  { href: "/planes", label: "Planes", icon: ClipboardList },
  { href: "/ejercicios", label: "Ejercicios", icon: Dumbbell },
  { href: "/carreras", label: "Carreras", icon: Flag },
  { href: "/certificados", label: "Certificados", icon: FileCheck2 },
];

const NAV_ALUMNO = [
  { href: "/mi-plan", label: "Mi plan", icon: ClipboardList },
  { href: "/agenda", label: "Clases", icon: CalendarDays },
  { href: "/mis-marcas", label: "Marcas", icon: Timer },
  { href: "/carreras", label: "Carreras", icon: Flag },
  { href: "/mi-ficha", label: "Ficha", icon: HeartPulse },
];

export function Navbar({ session }: { session: Session }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAbierto,setMenuAbierto]=useState(false);
  useEffect(()=>{const ancho=window.matchMedia("(min-width: 768px)");const cerrar=()=>{if(ancho.matches)setMenuAbierto(false);};ancho.addEventListener("change",cerrar);return()=>ancho.removeEventListener("change",cerrar);},[]);
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const items = session.role === "coach" ? NAV_PROFE : NAV_ALUMNO;
  const nombreCompleto =
    session.role === "coach" ? `${session.nombre} · Profe` : `${session.nombre} · Alumno`;

  async function salir() {
    await logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full min-w-0 max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
          <SheetTrigger aria-label="Abrir menú de navegación" render={<Button variant="ghost" size="icon" className="size-11 shrink-0 md:hidden" />}><Menu className="size-5" /></SheetTrigger>
          <SheetContent side="left" className="data-[side=left]:h-dvh data-[side=left]:w-[min(19rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <SheetHeader><SheetTitle className="flex items-center gap-3"><span aria-hidden="true"><LogoBadge className="size-8" /></span>Aktiv</SheetTitle><SheetDescription>Navegación</SheetDescription></SheetHeader>
            <nav aria-label="Navegación móvil" className="space-y-1 px-3 pb-4">{items.map(({href,label,icon:Icon})=>{const activo=pathname===href||pathname.startsWith(`${href}/`);return <Link key={href} href={href} aria-current={activo?"page":undefined} onClick={e=>{if(!e.defaultPrevented)setMenuAbierto(false);}} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",activo?"bg-primary/12 text-primary":"text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-5 shrink-0" />{label}</Link>;})}</nav>
          </SheetContent>
        </Sheet>
        <Link
          href={items[0].href}
          className="flex shrink-0 items-center gap-2.5 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Aktiv, ir al inicio"
        >
          <LogoBadge className="size-8" />
          <span className="text-sm leading-none font-semibold tracking-tight">
            Aktiv
            <span className="mt-0.5 block text-[0.6rem] font-normal tracking-[0.2em] text-muted-foreground uppercase">
              Running
            </span>
          </span>
        </Link>

        <nav aria-label="Principal" className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
          {items.map(({ href, label, icon: Icon }) => {
            const activo = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-1 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-none sm:px-2 lg:px-3",
                  activo
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-[1.15rem] shrink-0" />
                <span className="hidden xl:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Mi perfil"
              title="Mi perfil"
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
              {session.role === "coach" && <DropdownMenuItem onClick={() => router.push("/manual")}><BookOpen />Manual de uso</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => setCambiandoClave(true)}>
                <KeyRound />
                Cambiar contraseña
              </DropdownMenuItem>
              <DropdownMenuItem onClick={salir}>
                <LogOut />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CambiarClaveDialog abierto={cambiandoClave} onCerrar={() => setCambiandoClave(false)} />
    </header>
  );
}
