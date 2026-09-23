-- =====================================================================
-- Tablero Finora · esquema de la base de datos (Supabase / Postgres)
-- Se corre UNA vez en Supabase → SQL Editor → pegar todo → Run.
-- Se puede volver a correr sin romper nada: no borra datos.
-- =====================================================================

-- ---------- Lista de invitados ----------
-- Solo los emails de esta tabla pueden ver y editar el tablero.
-- La primera persona que entra con su email confirmado queda invitada sola
-- (ver verificar_acceso); después, el equipo invita desde la vista Equipo.
create table if not exists public.equipo_permitido (
  email        text primary key check (email = lower(email)),
  agregado_por uuid default auth.uid(),
  creado       timestamptz not null default now()
);

-- ---------- Documentos del tablero ----------
-- Guarda las mismas colecciones que la versión de Claude:
-- tablero (config), integrantes, tareas, comentarios e hitos.
create table if not exists public.docs (
  coleccion       text not null,
  id              text not null,
  data            jsonb not null default '{}'::jsonb,
  actualizado     timestamptz not null default now(),
  actualizado_por uuid default auth.uid(),
  primary key (coleccion, id)
);

-- Contador para los códigos FIN-1, FIN-2… (solo lo toca siguiente_numero)
create table if not exists public.contador (
  id text primary key,
  n  integer not null default 0
);
insert into public.contador (id, n) values ('tareas', 0) on conflict (id) do nothing;

-- ---------- ¿Quién es del equipo? ----------
-- Exige email confirmado: así nadie puede registrarse con el email de otro.
create or replace function public.es_del_equipo()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.equipo_permitido p on p.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

-- Email de quien está conectado (auth.users no se puede leer directo)
create or replace function public.mi_email()
returns text
language sql stable security definer set search_path = public
as $$
  select lower(email) from auth.users where id = auth.uid();
$$;

-- Se llama al entrar. Si la lista está vacía, la primera cuenta confirmada
-- queda invitada (así no hay que escribir tu email en este archivo).
create or replace function public.verificar_acceso()
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_email text;
begin
  select lower(email) into v_email
  from auth.users
  where id = auth.uid() and email_confirmed_at is not null;

  if v_email is null then
    return false;
  end if;

  if not exists (select 1 from public.equipo_permitido) then
    insert into public.equipo_permitido (email) values (v_email) on conflict do nothing;
  end if;

  return exists (select 1 from public.equipo_permitido where email = v_email);
end;
$$;

-- Número siguiente para el código de una tarea, sin choques entre dos personas.
create or replace function public.siguiente_numero(minimo integer default 0)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v integer;
begin
  if not public.es_del_equipo() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  insert into public.contador (id, n) values ('tareas', 0) on conflict (id) do nothing;
  update public.contador
     set n = greatest(n, coalesce(minimo, 0)) + 1
   where id = 'tareas'
  returning n into v;
  return v;
end;
$$;

-- Actualiza solo los campos que cambian (fusión de primer nivel).
-- Corre con los permisos de quien llama, así que respeta las reglas de abajo.
create or replace function public.actualizar_doc(p_coleccion text, p_id text, p_cambios jsonb)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  update public.docs
     set data = data || p_cambios
   where coleccion = p_coleccion and id = p_id;
  if not found then
    raise exception 'El documento no existe' using errcode = 'P0002';
  end if;
end;
$$;

-- Marca de tiempo y autor de cada cambio
create or replace function public.docs_tocar()
returns trigger
language plpgsql
as $$
begin
  new.actualizado := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;
drop trigger if exists docs_tocar on public.docs;
create trigger docs_tocar before insert or update on public.docs
  for each row execute function public.docs_tocar();

-- ---------- Permisos ----------
revoke all on public.docs from anon;
revoke all on public.equipo_permitido from anon;
revoke all on public.contador from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.docs to authenticated;
grant select, insert, delete on public.equipo_permitido to authenticated;

revoke all on function public.es_del_equipo() from public, anon;
revoke all on function public.mi_email() from public, anon;
revoke all on function public.verificar_acceso() from public, anon;
revoke all on function public.siguiente_numero(integer) from public, anon;
revoke all on function public.actualizar_doc(text, text, jsonb) from public, anon;
grant execute on function public.es_del_equipo() to authenticated;
grant execute on function public.mi_email() to authenticated;
grant execute on function public.verificar_acceso() to authenticated;
grant execute on function public.siguiente_numero(integer) to authenticated;
grant execute on function public.actualizar_doc(text, text, jsonb) to authenticated;

-- ---------- Reglas por fila (RLS) ----------
alter table public.docs enable row level security;
alter table public.equipo_permitido enable row level security;
alter table public.contador enable row level security;

drop policy if exists "equipo lee" on public.docs;
drop policy if exists "equipo crea" on public.docs;
drop policy if exists "equipo edita" on public.docs;
drop policy if exists "equipo borra" on public.docs;
create policy "equipo lee"   on public.docs for select to authenticated using ((select public.es_del_equipo()));
create policy "equipo crea"  on public.docs for insert to authenticated with check ((select public.es_del_equipo()));
create policy "equipo edita" on public.docs for update to authenticated using ((select public.es_del_equipo())) with check ((select public.es_del_equipo()));
create policy "equipo borra" on public.docs for delete to authenticated using ((select public.es_del_equipo()));

drop policy if exists "equipo ve invitados" on public.equipo_permitido;
drop policy if exists "equipo invita" on public.equipo_permitido;
drop policy if exists "equipo quita invitados" on public.equipo_permitido;
create policy "equipo ve invitados" on public.equipo_permitido for select to authenticated
  using ((select public.es_del_equipo()));
create policy "equipo invita" on public.equipo_permitido for insert to authenticated
  with check ((select public.es_del_equipo()));
-- Nadie puede sacarse a sí mismo (así el equipo nunca queda sin nadie adentro)
create policy "equipo quita invitados" on public.equipo_permitido for delete to authenticated
  using (
    (select public.es_del_equipo())
    and email <> (select public.mi_email())
  );

-- ---------- Tiempo real ----------
alter table public.docs replica identity full;
alter table public.equipo_permitido replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.equipo_permitido;
exception when duplicate_object then null;
end $$;
