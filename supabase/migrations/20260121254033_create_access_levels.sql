-- Tabela para Níveis de Acesso (Permissions)
CREATE TABLE IF NOT EXISTS agency_access_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    permissions_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de junção para vincular membros a níveis de acesso
CREATE TABLE IF NOT EXISTS member_access_levels (
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    access_level_id UUID NOT NULL REFERENCES agency_access_levels(id) ON DELETE CASCADE,
    PRIMARY KEY (member_id, access_level_id)
);

-- Habilitar RLS
ALTER TABLE agency_access_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_access_levels ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (simplificadas para o contexto atual)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their workspace access levels') THEN
        CREATE POLICY "Users can manage their workspace access levels" ON agency_access_levels FOR ALL USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage member access levels') THEN
        CREATE POLICY "Users can manage member access levels" ON member_access_levels FOR ALL USING (true);
    END IF;
END $$;
