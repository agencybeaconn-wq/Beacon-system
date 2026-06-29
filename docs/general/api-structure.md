# Estrutura da API e Nós Raiz

Visão geral dos principais nós raiz da API de Marketing e suas bordas (arestas) mais comuns.

## Nós Raiz (Root Nodes)

| Nó | Descrição |
| :--- | :--- |
| `/{AD_ACCOUNT_USER_ID}` | Usuário do Facebook que cria anúncios. |
| `/act_{AD_ACCOUNT_ID}` | Entidade empresarial (Conta de Anúncios) que gerencia os anúncios. |
| `/{AD_CAMPAIGN_ID}` | Campanha de anúncios (nível mais alto, define o objetivo). |
| `/{AD_SET_ID}` | Conjunto de anúncios (orçamento, cronograma, lance, direcionamento). |
| `/{AD_ID}` | Anúncio individual (criativo, mensuração). |
| `/{AD_CREATIVE_ID}` | Criativo do anúncio (imagem, vídeo, carrossel, etc.). |

## Bordas por Objeto

### Usuário (`/{AD_ACCOUNT_USER_ID}`)
*   `/adaccounts`: Contas de anúncios associadas.
*   `/accounts`: Páginas e locais administrados.
*   `/promotable_events`: Eventos que podem ser promovidos.

### Conta de Anúncios (`/act_{AD_ACCOUNT_ID}`)
*   `/campaigns`: Campanhas da conta.
*   `/adsets`: Conjuntos de anúncios da conta.
*   `/ads`: Anúncios da conta.
*   `/adcreatives`: Criativos definidos na conta.
*   `/adimages`: Biblioteca de imagens.
*   `/advideos`: Biblioteca de vídeos.
*   `/customaudiences`: Públicos personalizados.
*   `/insights`: Relatórios de desempenho.
*   `/users`: Pessoas associadas à conta.

### Campanha (`/{AD_CAMPAIGN_ID}`)
*   `/adsets`: Conjuntos de anúncios da campanha.
*   `/ads`: Anúncios da campanha.
*   `/insights`: Desempenho da campanha.

### Conjunto de Anúncios (`/{AD_SET_ID}`)
*   `/ads`: Anúncios do conjunto.
*   `/adcreatives`: Criativos usados.
*   `/activities`: Registro de alterações/ações.
*   `/insights`: Desempenho do conjunto.

### Anúncio (`/{AD_ID}`)
*   `/adcreatives`: Criativo associado.
*   `/leads`: Leads gerados (para anúncios de cadastro).
*   `/previews`: Gerar prévia do anúncio.
*   `/insights`: Desempenho do anúncio.

### Criativo (`/{AD_CREATIVE_ID}`)
*   `/previews`: Gerar prévias baseadas no criativo.
