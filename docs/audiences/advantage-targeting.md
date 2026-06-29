# Direcionamento Advantage (Advantage Targeting)

O Direcionamento Advantage permite que a Meta expanda automaticamente o público-alvo definido quando há probabilidade de obter melhores resultados a um custo menor.

## Conceitos Principais

A automação é controlada por três propriedades principais nas especificações de direcionamento:

1.  **`targeting_optimization_types`**:
    *   **Somente leitura**. Presente na especificação da campanha.
    *   Indica automação **forçada** (ex: expansão de Lookalike e Direcionamento Detalhado para certos objetivos).
    *   Exemplo: `{ "detailed_targeting": 1, "lookalike": 1 }`

2.  **`targeting_relaxation_types`**:
    *   **Editável**. Presente na especificação de direcionamento (`targeting`).
    *   Controla a aceitação (opt-in) para expansão de **Públicos Semelhantes (Lookalike)** e **Públicos Personalizados**.

3.  **`targeting_optimization`**:
    *   **Editável**. Presente na especificação de direcionamento.
    *   Controla a expansão de **Direcionamento Detalhado** (interesses, comportamentos).

## Automação Forçada (`targeting_optimization_types`)

Para as seguintes metas de otimização (`optimization_goal`), a expansão de Lookalike e Direcionamento Detalhado é ativada automaticamente (`1`) e não pode ser desativada:

*   `APP_INSTALLS` (Instalações do app)
*   `OFFSITE_CONVERSIONS` (Conversões fora do site)
*   `LINK_CLICKS` (Cliques)
*   `LANDING_PAGE_VIEWS` (Visualizações da página de destino)
*   `THRUPLAY` (Visualizações de vídeo)
*   `REACH` (Alcance - em alguns contextos)
*   `IMPRESSIONS` (Impressões - em alguns contextos)
*   `VALUE` (Valor)
*   `AD_RECALL_LIFT` (Lembrança do anúncio)
*   `DERIVED_EVENTS`
*   `CONVERSATIONS` (Conversas)
*   `LEAD_GENERATION` (Geração de cadastros)

*Nota: A lista exata pode variar conforme a versão da API e atualizações da Meta.*

## Limitações

A automação de direcionamento **NÃO** é suportada em:
*   Anúncios de **Categorias Especiais** (Moradia, Emprego, Crédito, Temas Sociais).
*   Tipo de compra **Reserva** (Reach & Frequency).

## Impacto na Entrega
A expansão permite que o sistema entregue anúncios para pessoas fora dos critérios estritos de interesses ou lookalikes definidos, mas **respeita** as restrições de:
*   Localização
*   Idade
*   Gênero
*   Exclusões explícitas
