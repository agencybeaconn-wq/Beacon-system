-- Fase 2 P1 (#15): o cliente não escreve store_apps direto via PostgREST.
-- A policy store_apps_client_update deixava o cliente gravar config quebrado
-- OU elevar push_limits (cota anti-spam) arbitrariamente. Toda escrita de
-- config do cliente passa a ser pela edge app-config-update (valida com Zod e
-- nunca toca push_limits). Staff (agency) mantém staff_all — é confiável.
-- Cliente mantém apenas leitura (store_apps_client_read).

drop policy if exists store_apps_client_update on public.store_apps;
