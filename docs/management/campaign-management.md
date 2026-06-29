# Gerenciamento de Campanhas de Anúncios

Gerenciar campanhas envolve modificar configurações, pausar, retomar, arquivar e excluir.

## 1. Modificar uma Campanha
Para atualizar uma campanha existente, envie uma solicitação `POST` ao ponto de extremidade `/<CAMPAIGN_ID>`.

**Exemplo:**
```bash
curl -X POST \
  https://graph.facebook.com/v24.0/<CAMPAIGN_ID> \
  -F 'objective=CONVERSIONS' \
  -F 'daily_budget=2000' \
  -F 'status=ACTIVE' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 2. Pausar e Retomar
Para pausar, atualize o status para `PAUSED`. Para retomar, defina como `ACTIVE`.

**Exemplo (Pausar):**
```bash
curl -X POST \
  https://graph.facebook.com/v24.0/<CAMPAIGN_ID> \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 3. Arquivar uma Campanha
Para interromper temporariamente sem excluir (mas removendo da visualização principal), defina o status como `ARCHIVED`.

**Exemplo:**
```bash
curl -X POST \
  https://graph.facebook.com/v24.0/<CAMPAIGN_ID> \
  -F 'status=ARCHIVED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 4. Excluir uma Campanha
Para remover permanentemente, envie uma solicitação `DELETE`. **Ação irreversível.**

**Exemplo:**
```bash
curl -X DELETE \
  https://graph.facebook.com/v24.0/<CAMPAIGN_ID> \
  -F 'access_token=<ACCESS_TOKEN>'
```
