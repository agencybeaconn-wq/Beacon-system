# Pedro — Tasks Operacionais

Tasks delegadas pelo João via Claude. Tickar quando concluído.

---

## 🔴 Prioridade alta — semana de 2026-05-13

### 1. Aprovação pendente de `read_orders` em 4 lojas

**Contexto:** O DW Beacon tá rodando mas 4 lojas voltaram **erro 403 — "merchant approval required for read_orders scope"**. Isso significa que o app Beacon foi instalado mas o cliente não chegou a aprovar permissões de leitura de pedidos.

**Lojas afetadas:**
- JGS Sports
- Mega Mantos
- Black Hype
- Puskas

**O que fazer:**
1. Abrir `https://supabase.com/dashboard/project/pxhmzpwvxvlwngjbjkrg` → tabela `agency_clients` → confirmar `shopify_domain` de cada
2. Pra cada uma, gerar novo link de instalação do app Beacon
3. Enviar pro cliente no WhatsApp: *"Oi [nome], precisamos que você reaprove o app Beacon pra liberar leitura de pedidos — link aqui: [link]. Leva 30 segundos."*
4. Quando cliente aprovar, marcar aqui:

- [ ] JGS Sports
- [ ] Mega Mantos
- [ ] Black Hype
- [ ] Puskas

---

### 2. Destravar histórico completo (>60d) nos top 3

**Contexto:** Os apps Shopify atuais têm scope `read_orders` que limita pedidos aos últimos 60 dias por regra da Shopify. Pra ver histórico completo (necessário pra análise sazonal, comparação ano-a-ano, retenção), precisa adicionar scope `read_all_orders` e cliente reinstalar.

**Prioridade (por volume):**
- [ ] **Mantos do PH** (8.451 pedidos travados — desbloqueio = 6x mais dado)
- [ ] **Coringão Shop** (7.417 pedidos — base do Corinthians, crítico)
- [ ] **Voltz Club** (4.248 pedidos)

**Como fazer:**
1. Shopify Partner Dashboard → app de cada cliente → Configuration
2. Adicionar `read_all_orders` na lista de scopes solicitados
3. Gerar novo install link
4. Mandar pro cliente: *"Oi [nome], atualizamos o app Beacon pra puxar histórico completo dos teus pedidos — assim a gente consegue analisar sazonalidade e comparar com 2024/2025. Reinstala aqui: [link]. 1 minuto."*
5. Marcar acima quando feito.

**Importante:** Após reaprovação, avisar o João — o sistema vai re-rodar o backfill automaticamente e puxar tudo.

---

### 3. Pedir acesso BM real do Mantos do PH

**Contexto:** Mantos do PH é o #1 em receita (R$ 321k em 60d). A conta Meta atualmente vinculada no Beacon (`act_879815747934348` "Mantos do PH · BRL") **não é a operação real deles** — provavelmente está em outra Business Manager.

Sem acesso à BM correta, não dá pra cruzar Meta × pedidos do Mantos = **a maior fonte de venda da Beacon fica cega no DW**.

**O que fazer:**
1. Mensagem pro contato Mantos: *"Oi [nome], pra Beacon conseguir analisar e otimizar a performance dos teus anúncios Meta junto com os pedidos da Shopify, preciso que você adicione a Beacon Digital como **Partner** no Business Manager onde rodam as campanhas reais do Mantos. Posso te enviar tutorial em 30s."*
2. Quando aprovar, adicionar ad accounts deles ao `selected_ad_accounts` do cliente "Mantos do PH" no Supabase
3. Marcar:

- [ ] Mantos do PH adicionou Beacon como Partner no BM real

---

## Histórico
- 2026-05-13 — Tasks criadas. DW Beacon MVP rodando com 7 lojas, 60d históricos, R$ 546k em receita combinada (ver `brain/João Brain/02-businesses/lever/dw-status.md` quando criado).
