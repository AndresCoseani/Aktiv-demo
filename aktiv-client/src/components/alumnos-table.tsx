"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  UserSearch,
} from "lucide-react";
import { EstadoBadge, PagoTexto } from "@/components/estado";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { diasHasta, estadoPago, iniciales } from "@/lib/format";
import type { Alumno, Nivel } from "@/lib/types";
import { cn } from "@/lib/utils";

type FiltroEstado = "todos" | "activos" | "inactivos";
type FiltroNivel = "todos" | Nivel;
type FiltroPago = "todos" | "proximos" | "vencidos";

const ESTADOS = { todos: "Todos los estados", activos: "Activos", inactivos: "Inactivos" };
const NIVELES = {
  todos: "Todos los niveles",
  Principiante: "Principiante",
  Intermedio: "Intermedio",
  Avanzado: "Avanzado",
};
const PAGOS = { todos: "Todos los pagos", proximos: "Próximos 7 días", vencidos: "Vencidos" };

const POR_PAGINA = 8;

/** clases responsive por columna, aplicadas a header y celdas */
type Meta = { className?: string };

const columnas: ColumnDef<Alumno>[] = [
  {
    id: "nombre",
    accessorKey: "nombre",
    header: "Alumno",
    cell: ({ row }) => {
      const a = row.original;
      return (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-secondary text-xs font-medium">
              {iniciales(a.nombre)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link
              href={`/alumnos/${a.id}`}
              className="block truncate font-medium outline-none hover:underline focus-visible:underline"
            >
              {a.nombre}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              <span className="sm:hidden">{a.objetivo}</span>
              <span className="hidden sm:inline">{a.email}</span>
            </p>
          </div>
        </div>
      );
    },
  },
  {
    id: "estado",
    accessorFn: (a) => Number(a.activo),
    header: "Estado",
    cell: ({ row }) => <EstadoBadge activo={row.original.activo} />,
  },
  {
    id: "proximoPago",
    accessorFn: (a) =>
      a.proximoPago ? diasHasta(a.proximoPago) : Number.POSITIVE_INFINITY,
    header: "Próximo pago",
    cell: ({ row }) => (
      <PagoTexto
        fecha={row.original.activo ? row.original.proximoPago : null}
        className="text-sm"
      />
    ),
  },
  {
    id: "plan",
    accessorFn: (a) => a.planes.find((p) => p.id === a.planActivoId)?.nombre ?? "",
    header: "Plan actual",
    enableSorting: false,
    meta: { className: "hidden md:table-cell" } satisfies Meta,
    cell: ({ row }) => {
      const a = row.original;
      const plan = a.planes.find((p) => p.id === a.planActivoId);
      return plan ? (
        <div className="leading-tight">
          <p className="text-sm">{plan.nombre}</p>
          <p className="text-xs text-muted-foreground">
            {a.planes.length > 1 ? `${a.planes.length} planes` : "1 plan"}
          </p>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Sin plan</span>
      );
    },
  },
  {
    id: "objetivo",
    accessorKey: "objetivo",
    header: "Objetivo",
    enableSorting: false,
    meta: { className: "hidden lg:table-cell" } satisfies Meta,
    cell: ({ row }) => (
      <div className="leading-tight">
        <p className="text-sm">{row.original.objetivo}</p>
        <p className="text-xs text-muted-foreground">{row.original.nivel}</p>
      </div>
    ),
  },
  {
    id: "ir",
    header: () => <span className="sr-only">Ver detalle</span>,
    enableSorting: false,
    meta: { className: "w-8 pl-0" } satisfies Meta,
    cell: () => (
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    ),
  },
];

export function AlumnosTable({ alumnos }: { alumnos: Alumno[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<FiltroEstado>("todos");
  const [nivel, setNivel] = useState<FiltroNivel>("todos");
  const [pago, setPago] = useState<FiltroPago>("todos");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "nombre", desc: false },
  ]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return alumnos.filter((a) => {
      if (q && !`${a.nombre} ${a.email} ${a.objetivo}`.toLowerCase().includes(q))
        return false;
      if (estado === "activos" && !a.activo) return false;
      if (estado === "inactivos" && a.activo) return false;
      if (nivel !== "todos" && a.nivel !== nivel) return false;
      if (pago !== "todos") {
        const e = estadoPago(a.activo ? a.proximoPago : null);
        if (pago === "vencidos" && e !== "vencido") return false;
        if (pago === "proximos" && e !== "hoy" && e !== "proximo") return false;
      }
      return true;
    });
  }, [alumnos, busqueda, estado, nivel, pago]);

  const tabla = useReactTable({
    data: filtrados,
    columns: columnas,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: POR_PAGINA } },
  });

  const filasPagina = tabla.getRowModel().rows;
  const { pageIndex } = tabla.getState().pagination;
  const desde = filtrados.length ? pageIndex * POR_PAGINA + 1 : 0;
  const hasta = Math.min((pageIndex + 1) * POR_PAGINA, filtrados.length);
  const hayFiltros =
    busqueda || estado !== "todos" || nivel !== "todos" || pago !== "todos";

  function limpiar() {
    setBusqueda("");
    setEstado("todos");
    setNivel("todos");
    setPago("todos");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, email u objetivo"
            aria-label="Buscar alumnos"
            className="h-9 pl-8"
          />
        </div>
        <FiltroSelect
          label="Estado"
          value={estado}
          onChange={(v) => setEstado(v as FiltroEstado)}
          opciones={ESTADOS}
        />
        <FiltroSelect
          label="Nivel"
          value={nivel}
          onChange={(v) => setNivel(v as FiltroNivel)}
          opciones={NIVELES}
        />
        <FiltroSelect
          label="Pagos"
          value={pago}
          onChange={(v) => setPago(v as FiltroPago)}
          opciones={PAGOS}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            {tabla.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta as Meta | undefined;
                  const orden = h.column.getIsSorted();
                  return (
                    <TableHead
                      key={h.id}
                      className={cn("h-10 text-xs", meta?.className)}
                      aria-sort={
                        orden === "asc"
                          ? "ascending"
                          : orden === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className="-ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium transition-colors hover:bg-muted hover:text-foreground"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {orden === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : orden === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {filasPagina.length ? (
              filasPagina.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => router.push(`/alumnos/${row.original.id}`)}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as Meta | undefined;
                    return (
                      <TableCell key={cell.id} className={cn("py-3", meta?.className)}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnas.length} className="h-48">
                  <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                    <UserSearch className="size-8 opacity-60" />
                    <p className="text-sm">No hay alumnos que coincidan.</p>
                    {hayFiltros && (
                      <Button variant="outline" size="sm" onClick={limpiar}>
                        Limpiar filtros
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <p aria-live="polite">
          {filtrados.length
            ? `${desde}–${hasta} de ${filtrados.length} alumnos`
            : "0 alumnos"}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            aria-label="Página anterior"
            onClick={() => tabla.previousPage()}
            disabled={!tabla.getCanPreviousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Página siguiente"
            onClick={() => tabla.nextPage()}
            disabled={!tabla.getCanNextPage()}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  opciones,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opciones: Record<string, string>;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v && onChange(v)}
      items={opciones}
    >
      <SelectTrigger
        aria-label={label}
        className={cn("h-9 w-full lg:w-44", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {Object.entries(opciones).map(([v, texto]) => (
          <SelectItem key={v} value={v}>
            {texto}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
