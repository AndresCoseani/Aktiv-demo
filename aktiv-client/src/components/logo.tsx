import { cn } from "@/lib/utils";

/**
 * Isotipo de Aktiv: un solo polígono, vectorizado a partir del logo original
 * (trazado sobre la imagen y simplificado a sus vértices). Si hay un SVG oficial,
 * alcanza con reemplazar el `d` de este path.
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
      viewBox="71 55 612 560"
      role="img"
      aria-label={title}
      className={cn("size-8", className)}
      fill="currentColor"
    >
      <path d="M366 70 L672 598 L404 598 L281 384 L199 520 L270 521 L313 598 L113 598 L81 566 L278 227 L452 521 L537 521 L322 144Z" />
    </svg>
  );
}

/** Isotipo dentro del círculo negro, como en el logo original */
export function LogoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid size-9 shrink-0 place-items-center rounded-full bg-black text-white ring-1 ring-primary/40",
        className,
      )}
    >
      <LogoMark className="size-[52%]" />
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
