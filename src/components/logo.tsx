import { cn } from "@/lib/utils";

/**
 * Isotipo de Aktiv redibujado en SVG a partir del logo (dos piezas blancas
 * con un corte diagonal). Si más adelante hay un SVG oficial, alcanza con
 * reemplazar los paths de este componente.
 */
export function LogoMark({
  className,
  title = "Aktiv",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="60 50 630 570"
      role="img"
      aria-label={title}
      className={cn("size-8", className)}
      fill="currentColor"
    >
      <path d="M372 70 672 598H408L452 515H535L322 150Z" />
      <path
        fillRule="evenodd"
        d="M275 235 452 515 318 598 80 572ZM280 385 202 515H312Z"
      />
    </svg>
  );
}

/** Isotipo dentro del círculo negro, como en el logo original */
export function LogoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid size-9 shrink-0 place-items-center rounded-full bg-black text-white ring-1 ring-white/10",
        className,
      )}
    >
      <LogoMark className="size-[55%]" />
    </span>
  );
}

/** Lockup "ENTRENAMIENTO INTEGRAL / y RUNNING" del logo */
export function LogoLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2.5", className)}>
      <span className="rounded-full border border-current/70 px-4 py-1 text-[0.65rem] font-medium tracking-[0.22em] uppercase sm:text-xs">
        Entrenamiento integral
      </span>
      <span className="flex items-baseline gap-2.5">
        <span className="font-serif text-lg text-primary italic">y</span>
        <span className="text-sm font-semibold tracking-[0.3em] uppercase">
          Running
        </span>
      </span>
    </div>
  );
}
