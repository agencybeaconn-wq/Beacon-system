# Padrão de Qualidade de Código Lever — Definition of Done

> **Regra-mãe:** todo código que sai daqui é **digno de produção da Lever**. Não existe "depois eu
> arrumo". A gente **amarra as pontas enquanto constrói** — não deixa fio solto. Vale pro Claude,
> pro squad, pra qualquer função / skill / edge function / script / migration.

## O princípio

Qualidade não é etapa final — é **como** a gente escreve desde a primeira linha. Cada peça nova
deixa o sistema **mais sólido e mais conectado**, nunca mais bagunçado. "Funciona na minha máquina"
ou "funcionou uma vez" **não é pronto**. O bar é: outra pessoa do squad (ou o Claude daqui a 2 meses)
abre esse código e entende, confia e estende sem medo.

---

## Definition of Done — só está PRONTO quando passa em TODOS

**Correção**
- [ ] Faz o que foi pedido — no caso feliz **e** nos casos de erro.
- [ ] **Testado de verdade** (rodou, não só compilou/buildou). Fluxo crítico (checkout, dinheiro,
      onboarding, deploy, dados de cliente) → testado **end-to-end**.
- [ ] Zero suposição não-verificada: confirmei caminhos, nomes de arquivo/função, schema, versões.

**Robustez**
- [ ] Erros tratados **explicitamente** — nada de `catch {}` silencioso. Falha alto, com mensagem
      acionável (diz o que fazer).
- [ ] Writes **idempotentes** onde faz sentido (rodar 2x não duplica nem quebra).
- [ ] Sem race condition em conversion-path / fila / estado compartilhado.

**Clareza**
- [ ] Lê como o código ao redor (mesmo estilo, nomes, idioma de comentário).
- [ ] Nomes dizem a intenção. Sem número mágico sem explicação.
- [ ] Comentário explica o **porquê** (gotcha, decisão), não o óbvio.

**Segurança**
- [ ] **Zero secret hardcoded** — sempre env/vault. Nunca printar token/raw API.
- [ ] Nenhum dado sensível em log, commit ou chat.

**Reuso — não duplicar**
- [ ] Reusei skill / lib / helper existente em vez de reescrever (**Skill-First**).
- [ ] Não copiei-colei lógica que já mora em `.claude/lib/`.

**Observabilidade**
- [ ] Operação longa / agente loga o que importa (custo, latência, erro).
- [ ] Falha deixa rastro pra diagnóstico — não some no silêncio.

**Amarrar as pontas — o que separa "ok" de "digno da Lever"**
- [ ] Atualizei **tudo** que a mudança toca: callers, tipos, `SKILL.md`, `CLAUDE.md` (routing),
      testes, doc no vault, e `memory` se virou regra/preferência.
- [ ] Não deixei código órfão, flag morta, `TODO` sem dono, nem **versões divergentes**
      (ex: imagem Docker ≠ versão no `package.json` — bug real que custou um deploy).
- [ ] Se reduzi cobertura (top-N, sem retry, sampling) → **disse explicitamente** o que ficou de fora.

---

## Como o Claude trabalha — sempre

1. **Entender antes de escrever** — ler o código e os docs canônicos. Não responder de memória.
2. **Plano mínimo** — escopo enxuto. Bateria grande (15+ itens, loja inteira, refactor amplo):
   perguntar **"top N ou tudo?"** antes (Regra Zero — custo-benefício).
3. **Implementar** no estilo local.
4. **Auto-review adversarial** — antes de dizer "pronto", **tente quebrar o próprio código**:
   "o que falha aqui? que ponta ficou solta? que caso eu não testei? que suposição pode estar errada?".
   Default cético. Se não consegue provar que está certo, **não está pronto**.
5. **Verificar** — rodar/testar de verdade e **reportar o resultado real**. Se falhou, dizer com o
   output — nunca maquiar.
6. **Fechar** — commit `tipo(area): descrição`, push, e amarrar as pontas (docs / memory / vault).

---

## Regras duras (não-negociáveis)

- **MCP-first** pra qualquer serviço com MCP conectado. Fallback (CLI/script/API) só com erro real
  depois de ≥1 retry, e **dizendo** "MCP falhou com X, indo via Y".
- **Nunca** deployar em massa edge functions (>3) sem OK explícito do João (incidente phase2-edgefns).
- **Zero emojis** em texto visível de produto/tema — só ícones SVG (`{% render 'icon-*' %}`).
- **Nunca empilhar iterações em conversion-path** — 1 patch, valida live, depois a próxima.
- **Confirmar antes** de ação destrutiva/irreversível (delete de serviço/dado, overwrite, mutation
  cross-store, deletar environment com volume). Olhar o alvo antes — se contradiz o que foi descrito,
  parar e avisar.

---

## Quando NÃO over-engineer

Qualidade ≠ gold-plating. **Não invente abstração antes de ter 2-3 casos reais.** Não adicione
camada/config "pro futuro" sem necessidade concreta. O bar é **"sólido e completo pro escopo"**,
não "enterprise genérico". Custo-benefício manda (Regra Zero). Amarrar as pontas é sobre não deixar
fio solto do que você FEZ — não sobre construir o que ninguém pediu.
