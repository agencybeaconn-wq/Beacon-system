-- Tabelas pra gerenciar webhook subscriptions do Shopify (reatividade em tempo real).
--
-- `webhook_subscriptions`: registro local de quais topics o Lever tá ouvindo por cliente.
-- `webhook_events`:         fila append-only de eventos recebidos (unprocessed + processed).
--
-- Dispara via skill /shopify watch <cliente> → que chama webhookSubscriptionCreate GraphQL
-- e insere nessa tabela pra referência local.

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,                         -- ex: "PRODUCTS_UPDATE", "ORDERS_PAID"
  shopify_subscription_id TEXT,                 -- gid://shopify/WebhookSubscription/NNN
  callback_url TEXT NOT NULL,
  format TEXT DEFAULT 'JSON',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT webhook_subscriptions_unique UNIQUE (client_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_client ON webhook_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_topic ON webhook_subscriptions(topic);

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  shop_domain TEXT NOT NULL,                    -- header X-Shopify-Shop-Domain
  topic TEXT NOT NULL,                          -- header X-Shopify-Topic
  webhook_id TEXT,                              -- header X-Shopify-Webhook-Id (dedup)
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ DEFAULT now(),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  process_result JSONB
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed
  ON webhook_events(received_at)
  WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_webhook_events_client_topic
  ON webhook_events(client_id, topic, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id
  ON webhook_events(webhook_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION touch_webhook_subscription_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_webhook_subscriptions_updated ON webhook_subscriptions;
CREATE TRIGGER trg_webhook_subscriptions_updated
  BEFORE UPDATE ON webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION touch_webhook_subscription_updated();

-- RLS: liberado pra service_role via edge functions (sem policy pública)
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies
CREATE POLICY "service_role_all_webhook_subscriptions"
  ON webhook_subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "service_role_all_webhook_events"
  ON webhook_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
