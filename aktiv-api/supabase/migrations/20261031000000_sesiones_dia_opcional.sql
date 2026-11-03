-- La sesión se organiza por tipo y orden (Fuerza Día 1, Running Día 1…).
-- El día calendario es una asignación opcional; se conservan los existentes.
begin;
alter table public.sesiones alter column dia drop not null;
commit;
