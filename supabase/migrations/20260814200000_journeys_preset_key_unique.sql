-- Módulo Apps Mobile — polimento 2026-08-14.
-- A TrackingTab upserta presets com onConflict (client_id, preset_key), mas a
-- constraint única não existia — o botão "ativar padrões" quebraria em produção
-- (42P10). Índice TOTAL de propósito: ON CONFLICT do PostgREST não infere índice
-- parcial; NULLs são distintos no Postgres, então jornadas custom (preset_key
-- null) continuam ilimitadas.

-- o índice veio PARCIAL da migration anterior (20260814180200) — trocar por total
drop index if exists public.journeys_client_preset_uidx;
create unique index journeys_client_preset_uidx
  on public.journeys (client_id, preset_key);
