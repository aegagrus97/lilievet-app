-- Foto de perfil del médico veterinario (la ven los tutores al elegir médico)
alter table app.mvz add column foto text,
  add constraint mvz_foto_check check (foto is null or foto ~ '^[0-9a-f-]{36}/[0-9]{10,16}\.jpg$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-mvz', 'fotos-mvz', true, 1048576, array['image/jpeg']);

-- Solo una cuenta de médico veterinario puede subir (lo usan las políticas de Storage)
create or replace function public.soy_mvz()
returns boolean language sql stable security definer set search_path to ''
as $function$ select exists (select 1 from app.mvz m join app.perfiles p on p.id = m.id where m.id = auth.uid() and not p.bloqueada) $function$;
revoke all on function public.soy_mvz() from public, anon, authenticated, service_role;
grant execute on function public.soy_mvz() to authenticated;

-- Cada médico solo sube, ve en la API y borra archivos de su propia carpeta (<su id>/<número>.jpg).
-- Las fotos se sirven por la URL pública del bucket.
create policy "fotos_mvz_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-mvz' and (storage.foldername(name))[1] = auth.uid()::text
              and name ~ '^[0-9a-f-]{36}/[0-9]{10,16}\.jpg$' and public.soy_mvz());
create policy "fotos_mvz_ver_propias" on storage.objects for select to authenticated
  using (bucket_id = 'fotos-mvz' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos_mvz_borrar_propias" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-mvz' and (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.guardar_foto_mvz(p_ruta text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare y app.perfiles := privado.yo('mvz'); v_anterior text;
begin
  if p_ruta is not null then
    if p_ruta !~ ('^' || y.id::text || '/[0-9]{10,16}\.jpg$')
       or not exists (select 1 from storage.objects o where o.bucket_id = 'fotos-mvz' and o.name = p_ruta) then
      perform privado.error('No pudimos guardar la foto. Intenta de nuevo.');
    end if;
  end if;
  select foto into v_anterior from app.mvz where id = y.id for update;
  update app.mvz set foto = p_ruta, actualizado_at = now() where id = y.id;
  -- La app borra el archivo anterior con esta ruta
  return case when v_anterior is distinct from p_ruta then v_anterior end;
end $function$
;
revoke all on function public.guardar_foto_mvz(text) from public, anon, authenticated, service_role;
grant execute on function public.guardar_foto_mvz(text) to authenticated;
