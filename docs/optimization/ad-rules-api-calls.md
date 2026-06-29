# Chamadas de API para Regras de Anúncios

Referência de endpoints para gerenciar, executar e monitorar regras de anúncios.

## Gerenciamento de Regras

### Ler Todas as Regras da Conta
```bash
curl -G \
-d 'fields=name,evaluation_spec,execution_spec,status' \
-d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/<VERSION>/<AD_ACCOUNT_ID>/adrules_library
```

### Ler uma Regra Específica
```bash
curl -G \
-d 'fields=name,evaluation_spec,execution_spec,status' \
-d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/<VERSION>/<AD_RULE_ID>
```

### Atualizar uma Regra
**Nota:** É necessário fornecer a especificação completa (`evaluation_spec`, etc.), mesmo para campos que não mudaram.

```bash
curl -F 'evaluation_spec={...}' \
-F 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/<VERSION>/<AD_RULE_ID>
```

### Excluir uma Regra
```bash
curl -X DELETE \
-d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/<VERSION>/<AD_RULE_ID>
```

## Histórico e Monitoramento

### Histórico de Execução de uma Regra
Retorna ações tomadas e resultados.
- **Filtros Opcionais:** `object_id`, `action`, `hide_no_changes=true`.

```bash
curl -G \
-d 'object_id=123' \
-d 'action=CHANGED_BID' \
-d 'hide_no_changes=true' \
-d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/<VERSION>/<AD_RULE_ID>/history
```

### Histórico da Conta (Todas as Regras)
Mesmos filtros do histórico de regra.

```bash
curl -G \
-d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/<VERSION>/<AD_ACCOUNT_ID>/adrules_history
```

## Execução e Teste

### Prévia (`Preview`)
Simula a avaliação da regra e retorna os objetos que corresponderiam aos filtros no momento.

```bash
curl -F 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/<VERSION>/<AD_RULE_ID>/preview
```

### Execução Manual (`Execute`)
Agenda a execução imediata de uma regra baseada em cronograma.

```bash
curl -F 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/<VERSION>/<AD_RULE_ID>/execute
```

## Regras que Regem um Objeto
Lista todas as regras aplicáveis a um anúncio, conjunto ou campanha específico.
- **Filtro `pass_evaluation`:** Se `true`, retorna apenas regras que atualmente avaliam como verdadeiro para este objeto.

```bash
curl -F 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/<VERSION>/<AD_OBJECT_ID>/adrules_governed
```
