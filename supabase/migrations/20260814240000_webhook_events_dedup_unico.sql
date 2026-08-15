-- Fase 2 P1 (#16): dedup de webhook no BANCO, não em SELECT-then-INSERT.
-- Hoje o dedup é lê-depois-insere: dois reenvios simultâneos da Shopify (mesmo
-- webhook_id) passam ambos pelo SELECT vazio e inserem 2 linhas → dobra
-- atribuição de pedido e rastreio. Índice único (por tenant) torna o INSERT a
-- fonte de verdade: o segundo bate 23505 e o handler o trata como duplicado.
--
-- Escopo por client_id: webhook_id é único por loja na Shopify; a tabela é
-- compartilhada entre tenants, então a chave lógica é (client_id, webhook_id).

-- pré-checagem: se já houver duplicatas, o unique falha. Remove-as mantendo a
-- primeira de cada (por id), pra a migration ser idempotente e segura.
delete from public.webhook_events a
using public.webhook_events b
where a.webhook_id is not null
  and a.webhook_id = b.webhook_id
  and a.client_id is not distinct from b.client_id
  and a.id > b.id;

drop index if exists public.idx_webhook_events_webhook_id;

create unique index if not exists webhook_events_client_webhook_uidx
  on public.webhook_events (client_id, webhook_id)
  where webhook_id is not null;
