-- =====================================================
-- Migration SEGURA: Adicionar cover_image_url na tabela tasks
-- Esta migration NÃO altera nenhum dado existente
-- Apenas ADICIONA uma coluna opcional (nullable)
-- =====================================================

-- PASSO 1: Adicionar coluna (só executa se não existir)
-- IF NOT EXISTS garante que não vai dar erro se já existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'cover_image_url'
    ) THEN
        ALTER TABLE tasks ADD COLUMN cover_image_url TEXT;
        RAISE NOTICE 'Coluna cover_image_url adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna cover_image_url já existe, pulando...';
    END IF;
END $$;

-- FIM! 
-- O Storage Bucket pode ser criado manualmente no painel do Supabase
-- se preferir, para ter controle total sobre as políticas.
