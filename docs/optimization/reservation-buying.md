# Compra por Reserva (Reservation / Reach & Frequency)

A compra por reserva permite planejar e comprar anúncios com custo fixo e entrega previsível (alcance e frequência controlados), similar à compra de TV.

## Requisitos e Restrições
- **Buying Type:** A campanha deve ter `buying_type=RESERVED`.
- **Elegibilidade:** A conta deve ter a permissão `CAN_USE_REACH_AND_FREQUENCY`.
- **Duração:** Mínimo de 1 dia, máximo de 90 dias (geralmente).
- **Antecedência:** Máximo de 180 dias entre a previsão e o fim do conjunto de anúncios.
- **Limitações:** Não permite orçamento diário (apenas total), veiculação acelerada ou lances manuais.

## Fluxo de Trabalho

### 1. Criar Previsão (`reachfrequencyprediction`)
Simula o alcance e orçamento.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/reachfrequencypredictions" \
  -F 'target_spec={"geo_locations": {"countries":["US"]}, ...}' \
  -F 'start_time=1388534400' \
  -F 'end_time=1389312000' \
  -F 'reach=1000000' \
  -F 'budget=3000000' \
  -F 'objective=POST_ENGAGEMENT' \
  -F 'destination_id=<PAGE_ID>' \
  -F 'access_token=<ACCESS_TOKEN>'
```
**Resposta:** Retorna um ID de previsão (ex: `67890123456`). O status inicial é `2` (Pending). Verifique até obter `1` (Success).

### 2. Reservar o Inventário
Confirma a compra e bloqueia o inventário.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/reachfrequencypredictions" \
  -F 'action=reserve' \
  -F 'rf_prediction_id=<RF_PREDICTION_ID>' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### 3. Criar Campanha e Conjunto de Anúncios
A campanha deve ser `RESERVED` e o conjunto deve receber o `rf_prediction_id`.

```bash
# Criar Campanha
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -F 'name=Reservation Campaign' \
  -F 'buying_type=RESERVED' \
  -F 'objective=POST_ENGAGEMENT' \
  ...

# Criar Conjunto de Anúncios (Atribuir Reserva)
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=Reservation Ad Set' \
  -F 'campaign_id=<CAMPAIGN_ID>' \
  -F 'rf_prediction_id=<RF_PREDICTION_ID>' \
  -F 'status=ACTIVE' \
  ...
```

## Sequenciamento de Anúncios (`creative_sequence`)
Permite definir uma ordem específica de exibição dos anúncios para o mesmo usuário.
- Definido no nível do conjunto de anúncios.
- O tamanho da sequência deve idealmente corresponder ao `frequency_cap`.

## Códigos de Status Comuns
- `1`: Sucesso.
- `2`: Pendente.
- `15`: Falha (Inventário insuficiente).
- `16`: Falha (Alcance mínimo não atingido).
- `19`: Falha (CPM inatingível).
