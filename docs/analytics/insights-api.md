# API de Insights (Estatísticas de Anúncios)

Interface unificada para recuperar métricas de desempenho de anúncios, conjuntos de anúncios, campanhas e contas.

## Endpoints Principais
A borda `/insights` está disponível em qualquer objeto de anúncio.

*   `act_<AD_ACCOUNT_ID>/insights`
*   `<CAMPAIGN_ID>/insights`
*   `<ADSET_ID>/insights`
*   `<AD_ID>/insights`

## Parâmetros Comuns

### 1. Nível de Agregação (`level`)
Define o nível de agrupamento dos dados (elimina duplicação).
*   `ad`, `adset`, `campaign`, `account`.

### 2. Campos (`fields`)
Lista de métricas separadas por vírgula.
*   Ex: `impressions,clicks,spend,reach,actions`

### 3. Intervalo de Datas
*   `date_preset`: Predefinições como `last_7d`, `yesterday`, `lifetime`.
*   `time_range`: Objeto JSON `{'since':'YYYY-MM-DD','until':'YYYY-MM-DD'}`.

### 4. Filtragem (`filtering`)
Filtra os resultados com base em campos e operadores.
*   Ex: `[{'field':'ad.adlabels','operator':'ANY', 'value':['Label Name']}]`

### 5. Ordenação (`sort`)
*   `{fieldname}_descending` ou `{fieldname}_ascending`.

## Janelas de Atribuição
Define o período de crédito para conversões após clique ou visualização.

*   **Parâmetro:** `action_attribution_windows`
*   **Valores:** `1d_click`, `7d_click`, `1d_view`.
*   **Padrão:** Se não especificado, usa `7d_click` (ou a configuração padrão da conta).

**Exemplo de Requisição:**
```bash
curl -G \
  -d "fields=spend,actions" \
  -d "action_attribution_windows=['1d_click','1d_view']" \
  -d "access_token=<TOKEN>" \
  https://graph.facebook.com/v24.0/act_<ID>/insights
```

## Objetos Excluídos e Arquivados
Por padrão, a API retorna apenas objetos ativos se filtros forem usados.

*   **Incluir Arquivados:** Use `filtering=[{'field':'ad.effective_status','operator':'IN','value':['ARCHIVED']}]`.
*   **Incluir Excluídos:** Use `filtering=[{'field':'ad.effective_status','operator':'IN','value':['DELETED']}]`.

## Limites e Melhores Práticas
*   **Paginação:** Use cursores `before`/`after` para navegar em grandes conjuntos de dados.
*   **Assíncrono:** Para grandes volumes de dados ou muitos objetos, use chamadas assíncronas (POST) para evitar timeouts.
*   **Rate Limiting:** A API possui limites de volume. Divida consultas grandes em menores (por data ou IDs) se encontrar erros.

## Discrepâncias com Gerenciador de Anúncios
A partir de junho de 2025, a API alinhará o comportamento com o Gerenciador de Anúncios:
*   `use_unified_attribution_setting` será descontinuado.
*   Valores de conversão seguirão a configuração de atribuição do Ad Set.
*   Ações serão reportadas com `action_report_time=mixed` (cliques no tempo da impressão, conversões offsite no tempo da conversão).
