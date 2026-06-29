-- =====================================================
-- SCRIPT DE REESTRUTURAÇÃO: Sistema de Permissões
-- Data: 2026-01-28
-- Objetivo: Garantir 1:1 entre membros e access levels
-- =====================================================

-- PASSO 1: Ver a situação atual (execute primeiro para entender)
SELECT 
    tm.email,
    tm.id as member_id,
    COUNT(mal.access_level_id) as total_access_levels,
    STRING_AGG(aal.name, ', ') as access_levels_names
FROM team_members tm
LEFT JOIN member_access_levels mal ON tm.id = mal.member_id
LEFT JOIN agency_access_levels aal ON aal.id = mal.access_level_id
GROUP BY tm.email, tm.id
HAVING COUNT(mal.access_level_id) > 1
ORDER BY total_access_levels DESC;

-- =====================================================
-- PASSO 2: Identificar duplicatas a serem removidas
-- Este SELECT mostra quais registros seriam deletados
-- (mantém apenas o registro mais recente por member_id)
-- =====================================================
SELECT 
    mal.member_id,
    mal.access_level_id,
    aal.name as access_level_name,
    tm.email,
    'SERIA DELETADO' as status
FROM member_access_levels mal
JOIN agency_access_levels aal ON aal.id = mal.access_level_id
JOIN team_members tm ON tm.id = mal.member_id
WHERE mal.ctid NOT IN (
    SELECT MAX(ctid) 
    FROM member_access_levels 
    GROUP BY member_id
);

-- =====================================================
-- PASSO 3: DELETAR duplicatas (CUIDADO - execute com atenção)
-- Mantém apenas o registro mais recente por member_id
-- =====================================================
-- DESCOMENTE PARA EXECUTAR:
/*
DELETE FROM member_access_levels
WHERE ctid NOT IN (
    SELECT MAX(ctid) 
    FROM member_access_levels 
    GROUP BY member_id
);
*/

-- =====================================================
-- PASSO 4: Adicionar constraint UNIQUE para prevenir
-- duplicatas futuras (só funciona após limpar duplicatas)
-- =====================================================
-- DESCOMENTE PARA EXECUTAR:
/*
ALTER TABLE member_access_levels 
ADD CONSTRAINT unique_member_access_level UNIQUE (member_id);
*/

-- =====================================================
-- PASSO 5: Verificar resultado final
-- Cada membro deve ter exatamente 1 access level
-- =====================================================
SELECT 
    tm.email,
    tm.id as member_id,
    COUNT(mal.access_level_id) as total_access_levels,
    MAX(aal.name) as access_level_name,
    jsonb_pretty(MAX(aal.permissions_config)) as permissions_preview
FROM team_members tm
LEFT JOIN member_access_levels mal ON tm.id = mal.member_id
LEFT JOIN agency_access_levels aal ON aal.id = mal.access_level_id
GROUP BY tm.email, tm.id
ORDER BY tm.email;

-- =====================================================
-- OPCIONAL: Ver estrutura de um access level específico
-- =====================================================
SELECT 
    name,
    permissions_config->>'role_type' as role_type,
    permissions_config->>'linked_client_id' as linked_client_id,
    permissions_config
FROM agency_access_levels
ORDER BY name;
