---
title: Beacon — Onboarding de Colaborador
tags: [onboarding, setup]
---

# 🚀 Onboarding — Time Beacon

> Setup completo do ambiente pra começar a trabalhar com código + DW + docs em **30-45 minutos**.

---

## 📋 Checklist (faz na ordem)

### 1. Instalar ferramentas (uma vez)

| Software | Onde | Pra que |
|---|---|---|
| **Git** | https://git-scm.com/download/win | Sincronizar código + docs com o time |
| **Node.js 20+** | https://nodejs.org | Rodar scripts do DW e dev local |
| **Obsidian** | https://obsidian.md | Editar/ler docs do vault Beacon |
| **Antigravity** *(ou VSCode/Cursor)* | qualquer um | Editar código |

---

### 2. Clonar o repositório Beacon

```powershell
cd "C:\Users\<seu-usuario>\Documents"
mkdir "João Workspace"   # se não existir
cd "João Workspace"
git clone <URL-DO-REPO-LEVER> lever
cd lever
npm install              # instala dependências do projeto
```

**Pede pra João/Pedro a URL do repo se não tiver.**

---

### 3. Abrir como Vault no Obsidian

1. Abre Obsidian
2. **Open another vault** → **Open folder as vault**
3. Aponta pra `C:\Users\<seu-usuario>\Documents\João Workspace\lever\`
4. Renomeia pra "Lever-System" se ele perguntar

---

### 4. Instalar plugin Obsidian Git (real-time sync)

Cada colaborador faz **1 vez**:

1. ⚙️ **Settings** → **Community plugins**
2. **Turn on community plugins** (Obsidian pergunta se aceita o risco — OK)
3. **Browse** → procura **"Git"** (autor Vinzent) → **Install** → **Enable**
4. Settings → Git → configura:
   - **Vault backup interval (minutes)**: `5`
   - **Auto pull interval (minutes)**: `3`
   - **Pull updates on startup**: ✅
   - **Push on backup**: ✅
   - **Commit message**: `vault: {{date}} - {{numFiles}} files (auto)`

✅ A partir daqui, qualquer doc que você editar no Obsidian sincroniza com o time automaticamente. E qualquer doc que o time editar aparece no seu Obsidian em 3 min.

---

### 5. Acesso ao Supabase (DW)

Pede pro João te convidar como **viewer** ou **developer** em:
https://supabase.com/dashboard/project/pxhmzpwvxvlwngjbjkrg

Depois disso, dá pra:
- Ver dados no **Table Editor**
- Rodar queries no **SQL Editor**
- Acessar **Storage** se precisar

---

### 6. Configurar `.env` local (só pra quem roda scripts)

Se você é Pedro/Wesley/Mídia e vai rodar scripts do DW:

1. Copia `.env.example` pra `.env`:
   ```powershell
   copy .env.example .env
   ```
2. Pede pro João as keys que faltam (Supabase, Shopify dev, etc)
3. **NUNCA** commita o `.env` (já tá no `.gitignore`)

---

## 🧭 Próximos passos por papel

### Atendimento / Gerente de cliente
1. Lê [[README|🧠 DW Visão geral]]
2. Lê [[03-clientes|🏪 Mapa clientes]]
3. Pra qualquer reunião, roda `node scripts/dw-report-client.mjs --client="<Nome>"` antes
4. Toda segunda, rola olho em [[01-status]] pra ver mudanças cross-loja

### Mídia (Meta/Google)
1. Lê [[README]] + [[04-relatorios|📈 Relatórios]]
2. **Toda segunda**: roda `node scripts/dw-report-meta.mjs`
3. Foco: **top 5 ads ROAS** (replicar cross-loja) + **15 ads queimando** (pausar)
4. Anota decisões em `lever/dw/decisions/YYYY-MM-DD-midia.md` (pasta a criar)

### Design / Criativo
1. Lê [[README]]
2. Antes de criar peça nova, roda o relatório Meta — pega top ROAS da categoria/time alvo
3. Replica padrão de criativo vencedor (texto + imagem) — não inventa do zero

### Operações / Pedro
1. Lê [[06-pedro-tasks|📋 Pedro tasks]] — é o teu kanban
2. Quando completar uma task, marca o `- [x]` no markdown e commita
3. Plugin Obsidian Git auto-sincroniza pro time inteiro

### Devs (código Beacon)
1. Lê [[CLAUDE]] — regras de engenharia
2. Lê [[README]] do DW pra entender as tabelas
3. Pra criar skill nova, segue padrão de `lever/.claude/skills/`
4. Trabalho normal em git: branch → commit → PR

---

## ❓ Problemas comuns

**"Conflito de merge no Obsidian Git"**
→ Abre o arquivo, resolve manualmente (junta as duas versões), commita. Acontece raro.

**"Plugin Obsidian Git mostra erro de autenticação"**
→ Precisa configurar credenciais Git (`git config --global user.email "..."`) ou rodar `gh auth login` se usa GitHub CLI.

**"Não tenho acesso ao Supabase"**
→ João convida pelo email teu.

**"Não tô vendo as docs do `dw/`"**
→ Garante que clonou o repo, deu `git pull`, e que o vault Obsidian aponta pra `lever/` (não `lever/dw/`).

---

## 📚 Onde achar tudo

- **Código** → `lever/src/`, `lever/scripts/`, `lever/supabase/functions/`
- **Skills (commands Claude)** → `lever/.claude/skills/`
- **Docs DW** → `lever/dw/` *(você tá aqui)*
- **Docs tema** → `lever/themes/KNOWLEDGE_BASE.md`
- **Playbooks Meta Ads** → `lever/docs/`
- **INDEX geral do vault** → `lever/INDEX.md`
