do $$ declare fk record; faltan bigint; condicion text; enlace text; begin
      for fk in select c.* from pg_constraint c join pg_class t on t.oid=c.conrelid
        join pg_namespace n on n.oid=t.relnamespace where c.contype='f' and n.nspname='public' loop
        select string_agg(format('s.%I is not null',a.attname),' and '),
               string_agg(format('s.%I=t.%I',a.attname,b.attname),' and ')
          into condicion,enlace from unnest(fk.conkey,fk.confkey) k(a,b)
          join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.a
          join pg_attribute b on b.attrelid=fk.confrelid and b.attnum=k.b;
        execute format('select count(*) from %s s where %s and not exists(select 1 from %s t where %s)',
          fk.conrelid::regclass,condicion,fk.confrelid::regclass,enlace) into faltan;
        if faltan>0 then raise exception 'Relaciones incompletas en restore'; end if;
      end loop;
    end $$;

-- Los vínculos JSON de la planificación también deben apuntar a rutinas recuperadas.
do $$
begin
 if to_regprocedure('public.comprobar_distribucion(jsonb,integer,jsonb)') is not null then
  execute 'select public.comprobar_distribucion(p.distribucion,p.semanas,coalesce((select jsonb_agg(jsonb_build_object(''id'',s.id,''tipo'',s.tipo)) from public.sesiones s where s.plan_id=p.id),''[]''::jsonb)) from public.planes_mensuales p';
  execute 'select public.comprobar_distribucion(distribucion,semanas,sesiones) from public.planes_modelo';
 end if;
end $$;
