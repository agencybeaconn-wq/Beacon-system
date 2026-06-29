# Limitação de Volume da API de Marketing

A API de Marketing tem a própria lógica de limitação de volume e está excluída de todos os limites de volume da Graph API.

## Cotas e Níveis de Acesso

| Acesso à API de Marketing | Acesso Padrão ao Gerenciamento de Anúncios | Capacidade |
| :--- | :--- | :--- |
| **Acesso ao desenvolvimento** | Acesso padrão | Cota básica de limitação de volume |
| **Acesso padrão** | Acesso avançado | Mais cota de limitação de volume |

A maior parte das solicitações está sujeita aos limites de volume de casos de uso de empresas (BUC). Verifique o cabeçalho HTTP `X-Business-Use-Case`.

## Tipos de Limites

### 1. Limites no nível da API da conta de anúncios
- **Pontuação:** Leitura = 1 ponto, Gravação = 3 pontos.
- **Desenvolvimento:** Máx 60 pontos, decaimento 300s (Bloqueio: 300s).
- **Padrão:** Máx 9.000 pontos, decaimento 300s (Bloqueio: 60s).
- **Erros:** Código 17 (Subcode 2446079), Código 613 (Subcode 1487742).

### 2. Limites no nível do App
- Determinado pela capacidade dos serviços ou total de usuários.
- **Erros:** Código 4 (Subcode 1504022, 1504039 ou msg "Application request limit reached").

### 3. Limites de Casos de Uso de Negócios (BUC)
Calculado por conta de anúncios em 1 hora.
- **ads_management:** (100k [Std] ou 300 [Dev]) + 40 * Anúncios Ativos.
- **custom_audience:** 190k-700k [Std] ou 5k [Dev] + 40 * Públicos Ativos.
- **ads_insights:** (190k [Std] ou 600 [Dev]) + 400 * Anúncios Ativos - 0.001 * Erros.
- **Erros:** Códigos 80000, 80003, 80004, 80014.

### 4. Outros Limites Específicos
- **Gastos com anúncios:** Alterar limites de gastos máx 10x/dia (Erro 17, Subcode 1885172).
- **Conjunto de anúncios (Orçamento):** Máx 4 alterações/hora por AdSet (Erro 613, Subcode 1487632).
- **Criação de anúncios:** Limitada pelo limite de gastos diário (Erro 613, Subcode 1487225).
- **Prevenção contra abusos:** Tráfego anormal (Erro 613, sem subcódigo).

## Como lidar com erros (Mitigação)

1. **Verifique os Cabeçalhos HTTP:**
   - `X-Ad-Account-Usage`: Uso percentual da conta.
   - `X-Business-Use-Case`: Contagem de chamadas, tempo de CPU.
   - `X-FB-Ads-Insights-Throttle`: Uso específico de insights.

2. **Estratégias:**
   - **Recuo Exponencial:** Aumente o tempo entre tentativas após um erro.
   - **Otimização:** Use solicitações em lote (batch requests) e solicite apenas os campos necessários.
   - **Assincronismo:** Use chamadas assíncronas para grandes volumes de dados (Insights).
   - **Cache:** Evite chamadas repetitivas desnecessárias.
