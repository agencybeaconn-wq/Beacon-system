# Diário — Agente QA

> Cérebro persistente. Cada auditoria registra entrada aqui. Achado novo é regressão de antes? Ou achado antigo aceito como "vou viver com"?

## Como ler
- Ordem cronológica reversa
- Filtrar por loja (Ctrl+F nome) ou check (#quality-gate, #audit-store, #template-lint, #template-parity, #pagespeed, #watchdog)

## Fontes que alimentaram este cérebro (Fase 0 — 2026-05-18)
- Skills: `quality-gate`, `audit-store`, `audit-smart-collections`, `dev-watchdog`, `template-lint`, `template-parity`, `pagespeed`, `compare-catalogs`
- Tabela `client_quality_runs` (histórico de runs do quality-gate)
- Memories: `feedback_no_emojis_use_icons`, `feedback_no_automation_without_permission`, `feedback_filtro_antes_de_agir`, `feedback_erro_vs_bug`, `feedback_browser_translate_false_positive`, `feedback_contact_source`, `feedback_sao_paulo_catchall_pattern`

## Padrões destilados

### Checks canônicos por skill
| Skill | Cobertura |
|---|---|
| `quality-gate` | 17 checks: preços, variants esgotadas, imagens faltando, coleções vazias, duplicados, coleções obrigatórias, menus quebrados, typos, SEO, API version, checkout.liquid legacy, webhooks |
| `audit-store` | 13 categorias, 50+ itens — saúde geral |
| `audit-smart-collections` | disjunctive OR + not_contains catch-all; AND muito restrito; handles divergentes |
| `dev-watchdog` | rotina diária 3h em Template BR + Template EN; drifts seguros auto-corrige, destrutivos alerta |
| `template-lint` | emojis em texto visível, hardcodes BRL em EN, handles PT em EN |
| `template-parity` | drift BR ↔ EN, features em só um lado |
| `pagespeed` | Core Web Vitals, gargalos JS/imagens |
| `compare-catalogs` | estrutural — catálogos de 2 lojas |

### Falsos-positivos conhecidos
- **PT em print de loja EN** pode ser tradução do navegador (Chrome/Brave translate) — fetch HTML antes de mexer em locales
- **shop.email/shop.phone do Admin** é do DONO, não atendimento — não usar pra páginas legais sem confirmar
- **Erro de tentativa-erro do Claude** ≠ bug real (regressão). Auditar só o segundo.

### Auto-fixes seguros (dev-watchdog aplica direto)
- Títulos com marca (clean-titles)
- SEO/vendor fora do padrão (bulk-product-meta)
- Smart collections com disjunctive bug (audit-smart-collections + fix)

### Auto-fixes destrutivos (NUNCA aplicar sem aval)
- Delete de produtos duplicados
- Mudança de preços
- Delete de coleções órfãs

---

## Entradas

<!-- Formato:
### YYYY-MM-DD — [Cliente] — [#check]
**Loja:** ...
**Checks rodados:** ...
**OK:** N
**Atenção:** [achados]
**Crítico:** [achados]
**Auto-fix sugerido (NÃO aplicado):** ...
**Comparação com run anterior:** regressão | mantém | melhora
-->

_Sem entradas ainda._
