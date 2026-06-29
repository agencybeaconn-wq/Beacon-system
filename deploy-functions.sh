#!/bin/bash

# Script para fazer deploy de todas as Edge Functions no Supabase
# Execute com: bash deploy-functions.sh

echo "🚀 Iniciando deploy das Edge Functions..."
echo ""

# Verifica se a CLI do Supabase está instalada
if ! command -v supabase &> /dev/null
then
    echo "❌ CLI do Supabase não encontrada!"
    echo "📦 Instalando Supabase CLI..."
    npm install -g supabase
fi

echo "✅ CLI do Supabase encontrada"
echo ""

# Link com o projeto (se ainda não estiver linkado)
echo "🔗 Linkando com o projeto Supabase..."
supabase link --project-ref pxhmzpwvxvlwngjbjkrg

echo ""
echo "📤 Fazendo deploy de todas as funções..."
echo ""

# Deploy de todas as funções
supabase functions deploy

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure as variáveis de ambiente no Supabase Dashboard"
echo "2. Configure os Redirect URLs em Authentication > URL Configuration"
echo "3. Execute a migration SQL no SQL Editor"
echo ""
echo "📖 Leia o arquivo: supabase/CONFIGURACAO_SUPABASE.md para mais detalhes"
