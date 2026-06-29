-- Adiciona campos pra grupo WhatsApp do cliente.
-- whatsapp_group_jid: identificador Evolution/WhatsApp do grupo (formato 1203...@g.us).
-- whatsapp_group_name: nome exibido (cache local da UI, evita refetch do Evolution).
-- Notificacoes de task concluida (e futuras) sao enviadas pra esse grupo via send-whatsapp.

ALTER TABLE agency_clients
    ADD COLUMN IF NOT EXISTS whatsapp_group_jid  text,
    ADD COLUMN IF NOT EXISTS whatsapp_group_name text;
