# Lever System — Instruções do Claude

> **Workspace pai:** Este projeto é parte do **João Workspace** em `~/Documents/João Workspace/`. Quando precisar de contexto cross-projeto (Kron, Nord) ou roteamento, abra Claude lá. O workspace tem `REGISTRY.md` e junctions pra todos os projetos.

> 🔁 **Squad sync — leia antes de começar:**
> 1. `git pull` (puxa código + skills novas que outros do squad pushed)
> 2. Ao terminar mudança em código, skill, ou doc do squad: `git add . && git commit && git push`
> 3. Skill nova ou alterada → vai em `lever/.claude/skills/<nome>/` e é commitada como qualquer código
> 4. Doc de squad (decisão, incidente, MOC) → Lever QI (vault Obsidian Sync — push automático). Doc pessoal → João Brain.
> 5. Em dúvida se algo é "minha máquina só" vs "squad inteiro" → pergunta no grupo antes de commitar.

---

## Regra Zero: Custo-Benefício

**Antes de qualquer bateria grande (15+ items, loja inteira, refactor): PERGUNTAR "top N ou tudo?" ANTES de começar.** Escopo mínimo, máximo resultado. Nunca rodar loja inteira à toa. Ver memory `feedback_custo_beneficio`.

**Custo-benefício em SKILL.md** — quando user pede "otimiza/corta skill": seguir memory `feedback_skill_optimization_method` (regras/lições/pitfalls intocáveis, MVP wall trava após convergência, skill já no lock NÃO corta de novo).

## Regra de Qualidade: Definition of Done

**Todo código é digno de produção da Lever — a gente amarra as pontas enquanto constrói.** Antes de dizer "pronto", a mudança passa pelo checklist de [`.claude/ENGINEERING-STANDARDS.md`](.claude/ENGINEERING-STANDARDS.md). O essencial:

- **Testado de verdade** (rodou, não só buildou); fluxo crítico = end-to-end. Sem suposição não-verificada.
- **Erros explícitos** — nada de `catch {}` silencioso. Falha alto e acionável.
- **Zero secret hardcoded**; reuso > duplicação (Skill-First); idempotência em writes.
- **Amarrar as pontas:** atualizar TUDO que a mudança toca — callers, tipos, `SKILL.md`, routing no CLAUDE.md, docs, memory. Sem código órfão, flag morta, ou versões divergentes (ex: imagem Docker ≠ `package.json`).
- **Auto-review adversarial obrigatório:** tente quebrar o próprio código antes de entregar. Se não prova que está certo, não está pronto.
- **Sem over-engineer** — qualidade ≠ gold-plating. Custo-benefício manda (Regra Zero).

Ler o doc completo antes de qualquer trabalho de código não-trivial.

## Regra Um: Skill-First

Se o pedido bate com a tabela, **invoque a skill** — não escreva código do zero.

| Se o user disser... | Invoque |
|---|---|
| "atualizar/mudar/corrigir preços", "tabela de preços", "cole esse preço", "valor das camisas" | `update-prices` |
| "auditar preços", "preços divergentes", "bater preços com o banco", "preços fora do padrão" | `bulk-fix-prices` |
| "importar produtos faltantes", "produtos do template que faltam", "copiar produtos" | `import-missing` |
| "limpar títulos", "tirar Nike/Adidas do título", "remover marcas", "corrigir Feminino/Feminina" | `clean-titles` |
| "alterar descrições", "padronizar descrições", "aplicar template de descrição" | `bulk-descriptions` |
| "trocar vendor/fabricante/comerciante dos produtos", "padronizar SEO dos produtos", "aplicar meta title/description", "setar product_type em massa" | `bulk-product-meta` |
| "produtos duplicados", "tem produto repetido", "merge duplicatas", "remover repetidos" | `dedupe-products` |
| "ordenar coleções", "organizar produtos", "reorganizar por ano/tipo" | `sort-collections` (default: todas as coleções) |
| "Brasil primeiro nas coleções", "time brasileiro na frente", "priorizar brasileiros na ordenação" | `sort-collections --priority-br --only-handles=...` |
| "reorganizar a Home", "arruma a vitrine", "organiza a loja" | `sort-collections --home-plan` — ler `templates/index.json`, interpretar cada vitrine, montar plan por handle |
| "criar páginas legais", "aviso legal", "política de privacidade", "FAQ padrão" | `create-standard-pages` |
| "criar página de rastreio", "página de tracking", "acompanhar pedido", "rastreio 17track", "página igual a [loja] de rastreio" | `create-tracking-page` |
| "menu com links quebrados", "consertar menu", "item de menu órfão" | `fix-broken-menus` |
| "submenus por liga", "expandir Premier League/Brasileirão no menu", "adicionar clubes/times nas ligas do menu", "submenu de clubes" | `build-league-submenus` |
| "coleção vazia", "smart collection não popula", "coleções sem produto" | `fix-empty-collections` |
| "auditar smart collections", "coleção mostrando produtos errados", "regra OR virou catch-all", "coleção com condição errada", "alinhar coleções com tema" | `audit-smart-collections` |
| "editar tema ao vivo", "preview em tempo real", "hot reload tema" | `lever-theme watch` |
| "configurar tema", "announcement bar", "frete grátis", "contato no rodapé" | `configure-theme` |
| "editar tema", "push tema", "pull tema", "propagar tema", "seção do tema", "snippet" | `lever-theme` |
| "corrigir handles", "handles em português na loja EN", "URL da coleção" | `fix-handles` |
| "licença inválida na storefront", "overlay Lever Digital", "tema bloqueado por licença" | `fix-theme-license` |
| "padronizar opções", "tamanhos PP/5GG", "escassez", "renomear Size→Tamanho" | `fix-options` |
| "deploy loja", "subir loja nova", "replicar template" | `deploy-store` |
| "checar pré-requisitos pra deploy", "tá pronto pra deploy?" | `preflight-deploy` |
| "deploy end-to-end", "subir loja completa", "implementar tudo de uma vez", "medir tempo do deploy" | `deploy-complete` |
| "clonar loja inteira", "backup de loja", "espelhar loja X em Y", "loja igual a outra" | `clone-store` |
| "auditoria da loja", "saúde da loja", "relatório completo" | `audit-store` |
| "radar de qualidade", "gargalos", "variantes esgotadas", "produtos sem imagem" | `quality-gate` |
| "rodar watchdog", "conferir lojas de dev", "padrão diário", "auto-fix diário" | `dev-watchdog` |
| "implementar demandas do cliente", "rodar o kanban", "executar tasks" | `implement` |
| "criar cupom", "desconto PAGUE X LEVE Y", "promoção", "compre 2 leve 3" | `create-discount` |
| "criar segmento de clientes", "lista de email marketing", "quem comprou camisa do [time]", "win-back", "comprou X e sumiu há N dias", "carrinho abandonado só do [time]", "lista pra Reportana/Klaviyo" | `create-segments` |
| "promoção tá pegando patch", "patch entrando na PAGUE 1 LEVE 2", "exclui patches da promoção", "fixa o cupom que tá bagunçado" | `create-discount` (seção "Fixar promoção EXISTENTE que está pegando patches") |
| "personalização inline", "tirar drawer lateral de personalização", "Nome+Número direto na PDP", "patches em cards visuais", "igual Mantos do PH na PDP" | `inline-customization` |
| "planejar", "o que fazer com o cliente X", "bolar plano" | `plan` |
| "criar componente React" | `component` |
| "criar edge function Supabase" | `edge-function` |
| "copiar/replicar feature de loja pra outra", "põe a mesma de X", "carrinho lateral", "1:1", "propaga" | `code-blocks` (modo **CÓPIA**) |
| "estilo / referência / baseado em / inspirar na loja X", "estrutura igual", "usa X como ref" | `code-blocks` (modo **INSPIRAÇÃO** — adapta com brand/contexto do destino, não copia literal) |
| "gerar imagem", "criar capa com IA", "nano banana", "estudio ia", "imagem pra curso/banner/story" | `estudio-ia` |
| "gerar criativos", "variações de criativo", "adapta arte pra time/loja X", "criativos pra Brasileiríssimo/Loja da Torcida/Puskas/Mantos do PH/Diário Stores", "criar artes pra time + loja com URL Shopify" | `criacao-criativos` |
| "lintar tema", "checar emoji no tema", "validar template fonte", "regras lever no tema" | `template-lint` |
| "responder cliente no whatsapp", "responde como heloisa", "abre o zap do cliente X", "veja a última mensagem desse número" | `heloisa-reply` |
| "comparar tema BR e EN", "tema EN tá defasado", "drift entre templates", "feature só num lado" | `template-parity` |
| "pagespeed", "core web vitals", "loja tá lenta", "score de desempenho", "ranking de velocidade", "gargalos de performance/imagens/JS" | `pagespeed` |
| operações Shopify genéricas não cobertas acima (pedidos, CRUD avulso) | `shopify` (fallback) |

**Tema vago:** não adivinhe arquivos. Use `node .claude/lib/theme-knowledge.mjs "descrição"`, confirme, invoque `/lever-theme`.

**Nenhuma skill bate:** perguntar "(a) ad-hoc ou (b) skill nova?". Ad-hoc segue `.claude/PROTOCOL.md`. Skill nova precisa aprovação.

**Nunca:** escrever `.mjs` novo pra algo que skill faz · adivinhar skill ambígua · duplicar código de `.claude/lib/`.

---

## Identidade Lever

- **Lever-System** = Claude Boss · **Pasta de loja** = peça · **Pedro** decide tudo
- BR e EN nunca se misturam · Nunca copiar preços entre lojas · Filtro cascata anti-duplicatas
- **Customize SEMPRE mais cara que No** — senão BxGy dá grátis a personalizada
- **Patches são extensões da camisa** — BxGy usa collection "All Jerseys" (ou `Camisas Promo` smart filtrando tag `excluded-from-promo`), não "All Products"
- **Zero emojis em textos visíveis** — só ícones SVG `{% render 'icon-*' %}`
- **BR vs EN é contextual** — regras como "Brasil primeiro" só pra lojas BR (currency BRL/locale pt). Lojas EN (Brasileirissimo, GM Sports, MatchWear) usam regra canônica TEAM_POPULARITY (Real Madrid, Barça, Inter Miami) sem priorizar brasileiros. Auto-detect via `shop.json` em skills sensíveis (sort-collections já faz)
- **Properties com `_` aparecem em checkout custom** (Yampi/CartPanda) — NÃO usar `properties[_foo]` pra dados auxiliares. Cachear em `localStorage` ou ler do DOM

## Modo Ativo (sempre ligado)

Quando colaborador fala de uma loja: rastreia sessão, flaga padrões, compara com `blocks/history/`, dá aval honesto quando perguntado "tá pronta?". Detalhes em memory `project_lever_modo_ativo`.

## Operacional

- **Rate limit (429):** mesma loja + writes → serialize (6 req/s REST). Lojas diferentes → paralelo. Read-only → sempre paralelo. Delay 500-800ms.
- **Docs Shopify:** antes de criar mutation nova → `node .claude/lib/shopify-docs.mjs "query"`
- **Tokens:** nunca imprimir respostas raw API — processar em Node.js. Bulk (50+) → background Bash. Ler `.env`, nunca hardcodar.
- **Deploy em massa de edge functions:** NUNCA rodar script que deploya múltiplas edge functions (>3) sem OK explícito do João. Caso disparador: `phase2-deploy-edgefns.sh` em 2026-05-19 sobrescreveu 45 fns do Lever System com código do Leverads.AI antigo. Ver memory `phase2-edgefns-incident-2026-05-19`. Scripts do tipo `*deploy-edgefns*.sh` estão em `.gitignore`.

---

## Workflow Git — squad sincronizado todo dia

**O problema que isso resolve:** time depende de "commitar na main e os outros darem pull". Resultado: você fica 15 dias sem fetch e descobre que seu trabalho conflita com 3 features dos outros.

**A regra:** **antes de codar de manhã, rode `git sync`. Antes de sair, commit + push.**

### Setup uma vez (cada membro do squad)

Veja [ONBOARDING.md](ONBOARDING.md) — passo-a-passo completo (10 min). Resumo dos aliases:

```bash
git config --global alias.sync  '!bash "$(git rev-parse --show-toplevel)/.claude/git-tools/sync.sh"'
git config --global alias.daily '!bash "$(git rev-parse --show-toplevel)/.claude/git-tools/daily-summary.sh"'
git config --global alias.done  '!bash "$(git rev-parse --show-toplevel)/.claude/git-tools/done.sh"'
```

Depois disso você tem `git sync`, `git daily` e `git done` em qualquer repo Lever.

### Rotina diária (~30 segundos no total)

**De manhã, ao abrir o PC:**
```bash
git daily        # vê o que o squad fez ontem (commits, áreas mexidas, branches ativos)
git sync         # alinha sua branch com o main atualizado
```

**Ao terminar uma sub-tarefa ou ao sair:**
```bash
git done "feat(area): o que fez"
```

O `git done` faz tudo: confirma os arquivos, valida formato da mensagem, commita, pusha. Se você esquecer e fechar a sessão do Claude Code, o **hook Stop avisa** "você tem N arquivos não-commitados".

Se a feature está pronta pra review, abre PR:
```bash
gh pr create
```

### Convenções

- **1 branch por pessoa** como linha principal: `joao-vithor`, `pedro`, `Campanhã`, etc. Já existem.
- **Branches `feature/x`** pra features grandes que vão demorar dias e precisam isolar do resto.
- **Commits frequentes** (a cada chunk de trabalho lógico). Não acumular 17 arquivos como "trabalho do dia".
- **Mensagem padrão:** `tipo(area): descrição curta`
  - tipos: `feat`, `fix`, `style`, `refactor`, `docs`, `chore`
  - exemplo: `feat(crm): add column reorder via drag`
- **Sempre `git sync` antes de mexer em código compartilhado** (componentes Lever-OS, skills, edge functions). Pra mudança em pasta isolada de cliente, pode esperar.

### Conflito de merge

Se `git sync` der conflito:
1. Resolve no editor (procura `<<<<<<<`)
2. `git add <arquivo-resolvido>`
3. `git commit` (finaliza o merge)
4. Ou: `git merge --abort` pra cancelar e pensar

Se tá complexo demais, **pergunta no canal antes de forçar resolução**.

### Scripts e hook

- [`.claude/git-tools/sync.sh`](.claude/git-tools/sync.sh) — fetch + merge main → sua branch + relatório
- [`.claude/git-tools/daily-summary.sh`](.claude/git-tools/daily-summary.sh) — o que o squad fez nas últimas 24h (configurável)
- [`.claude/git-tools/done.sh`](.claude/git-tools/done.sh) — add + commit + push em 1 comando, com confirmação e validação
- [`.claude/hooks/stop-git-reminder.sh`](.claude/hooks/stop-git-reminder.sh) — hook Stop do Claude Code que avisa quando você fecha sessão com trabalho não-salvo

### Onboarding

Membro novo: veja [ONBOARDING.md](ONBOARDING.md).
