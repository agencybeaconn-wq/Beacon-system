---
title: Beacon — Onboarding Rápido (5 min)
tags: [onboarding, quick]
---

# 🚀 Onboarding Rápido — Beacon

> Setup completo em **1 comando**. Pra colaborador novo.

---

## 1. Abre qualquer terminal Windows

Tecla **Windows** → digita "**PowerShell**" → clica em **Windows PowerShell**
*(qualquer terminal funciona, mas PowerShell é o mais simples)*

## 2. Cola e roda este comando

```powershell
powershell -ExecutionPolicy Bypass -Command "iwr -useb https://gist.githubusercontent.com/leveragency/76539d1e0cfc485309c588757b8dffba/raw/setup-lever.ps1 | iex"
```

*Esse comando funciona em PowerShell, CMD ou Terminal — qualquer um.*

## 3. Responde 2 perguntas

O script pergunta:
- **Seu nome** (pra git — ex: "Wesley Souza")
- **Seu email** (pra git — ex: "wesley@levergroup.com.br")

## 4. Espera ~3-5 minutos

Vai aparecer na tela:
```
✓ Git já instalado
✓ Node.js instalado
✓ Obsidian instalado
✓ Repo clonado
✓ Plugin Obsidian Git configurado
✅ TUDO PRONTO
```

## 5. Abre o Obsidian

1. Abre Obsidian
2. **Open another vault** → **Open folder as vault**
3. Aponta pra: `C:\Users\<seu-usuario>\Documents\João Workspace\lever`
4. Quando perguntar sobre Modo Restrito, clica **"Confiar"**

## 6. Pronto pra trabalhar

Lê primeiro:
- [[dw/README]] — visão geral
- [[dw/ONBOARDING]] — onboarding completo com rotina por papel

Qualquer doc editado aqui no Obsidian, em **5 min** sincroniza pro time inteiro.
Toda vez que você abrir, vai puxar os updates dos outros automaticamente.

---

## Deu erro?

**"winget não reconhecido"** → atualiza Windows pra versão mais recente OU instala o App Installer: https://aka.ms/getwinget

**"Permission denied" no git clone** → você precisa de acesso ao repo. Pede pro João te adicionar (manda teu username GitHub).

**"npm install falhou"** → não é problema crítico — abre PowerShell na pasta `lever\` e roda `npm install` manual. Continua o resto.

**Plugin Git diz "Git is not ready" no Obsidian** → confirma que abriu o vault na pasta `lever\` (não em outra). A pasta tem que ter `.git\` dentro.

**Outro erro** → manda print no grupo + chama João/Pedro.
