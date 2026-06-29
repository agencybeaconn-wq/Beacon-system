# Novo Projeto

Um template baseado em React + Vite com Supabase.

## Stack Tecnológica

- **Frontend:** React, TypeScript, Vite
- **UI:** shadcn-ui, Tailwind CSS
- **Backend:** Supabase (não configurado)

## Setup

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
# Edite o arquivo .env com suas credenciais do Supabase

# Iniciar servidor de desenvolvimento
npm run dev
```

## Configuração do Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Copie as credenciais para o arquivo `.env`:
   - `VITE_SUPABASE_PROJECT_ID`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_URL`
3. Gere os tipos TypeScript: `npx supabase gen types typescript`
