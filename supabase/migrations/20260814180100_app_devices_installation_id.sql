-- Device existe independentemente da permissão de push.
-- installation_id é um UUID aleatório persistido no AsyncStorage do app.

alter table public.app_devices
  add column if not exists installation_id uuid;

-- Registros antigos continuam identificáveis sem inventar um vínculo novo.
update public.app_devices
set installation_id = id
where installation_id is null;

alter table public.app_devices
  alter column installation_id set not null,
  alter column expo_push_token drop not null,
  alter column push_enabled set default false;

alter table public.app_devices
  drop constraint if exists app_devices_app_id_expo_push_token_key;

create unique index if not exists app_devices_app_installation_uidx
  on public.app_devices (app_id, installation_id);

create unique index if not exists app_devices_app_push_token_uidx
  on public.app_devices (app_id, expo_push_token)
  where expo_push_token is not null;

comment on column public.app_devices.installation_id is
  'Identidade anônima e estável da instalação, independente de push.';
