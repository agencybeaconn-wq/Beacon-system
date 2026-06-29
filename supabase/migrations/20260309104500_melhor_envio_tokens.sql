CREATE TABLE IF NOT EXISTS melhor_envio_tokens (
    id SERIAL PRIMARY KEY,
    environment TEXT NOT NULL UNIQUE, -- 'sandbox' or 'production'
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE melhor_envio_tokens ENABLE ROW LEVEL SECURITY;

-- Allow read/write to service role only, no public access
CREATE POLICY "Service Role Full Access" ON melhor_envio_tokens
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
