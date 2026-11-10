-- 45: movilidad y activación separadas; los ejercicios anteriores conservan su contenido.
begin;
create or replace function public.activacion_sesion_valida(datos jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare elemento jsonb; ids text[] := '{}'; identificador text;
begin
  if jsonb_typeof(datos) is distinct from 'array' then return false; end if;
  if jsonb_array_length(datos) > 20 then return false; end if;
  for elemento in select value from jsonb_array_elements(datos) loop
    if jsonb_typeof(elemento) is distinct from 'object' then return false; end if;
    if (elemento - array['id','nombre','indicacion','fase']) <> '{}'::jsonb then return false; end if;
    if jsonb_typeof(elemento->'id') is distinct from 'string'
      or jsonb_typeof(elemento->'nombre') is distinct from 'string'
      or jsonb_typeof(elemento->'indicacion') is distinct from 'string' then return false; end if;
    if elemento ? 'fase' and (jsonb_typeof(elemento->'fase') is distinct from 'string' or elemento->>'fase' not in ('Movilidad','Activación')) then return false; end if;
    identificador := elemento->>'id';
    if identificador !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or lower(identificador) = any(ids)
      or length(elemento->>'nombre') > 120 or length(elemento->>'indicacion') > 300 then return false; end if;
    ids := array_append(ids, lower(identificador));
  end loop;
  return true;
end;
$$;
notify pgrst, 'reload schema';
commit;
