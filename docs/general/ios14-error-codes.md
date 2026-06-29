# Referência de Códigos de Erro do iOS 14

Lista de erros específicos relacionados às restrições e requisitos do iOS 14+ e SKAdNetwork.

## Tabela de Erros

| Código | Mensagem de Erro (Resumo) | Endpoints Afetados |
| :--- | :--- | :--- |
| **1870125** | Públicos de atividade de app não permitidos para inclusão em campanhas iOS 14. | `POST /adsets` |
| **1870141** | Conexões de apps não permitidas para campanhas iOS 14. | `POST /adsets` |
| **2446632** | Campanhas iOS 14 só podem promover apps iOS. | `POST /campaigns` |
| **2446685** | Sem permissão para veicular campanha de instalação para este app. | `POST /campaigns` |
| **2446686** | Limite de contas de anúncios promovendo o mesmo app atingido. | `POST /campaigns` |
| **2446692** | ID de app do iTunes já em uso em nova campanha. | `POST /campaigns` |
| **2446693** | App requer SDK do Facebook v8.0+. | `POST /adsets`, `POST /campaigns` |
| **2446694** | App requer SDK de MMP atualizado. | `POST /adsets`, `POST /campaigns` |
| **2446695** | API SKAdNetwork não configurada no Gerenciador de Eventos. | `POST /adsets`, `POST /campaigns` |
| **2446697** | Conta de anúncios já está promovendo este app. | `POST /campaigns` |
| **2446698** | Não é possível alterar o tipo de campanha após publicação (iOS 14). | `POST /campaigns` |
| **2446699** | URL do iTunes obrigatória. | `POST /campaigns` |
| **2446700** | ID de app do iTunes obrigatório. | `POST /campaigns` |
| **2490208** | Otimização de veiculação deve ser igual em todos os conjuntos. | `POST /ads` |
| **2490216** | Custo-alvo não disponível. | `POST /adsets`, `POST /campaigns` |
| **2490217** | Instalações de app não permitidas como evento de cobrança/otimização. | `POST /adsets` |
| **2490238** | Limite de 5 conjuntos de anúncios por campanha atingido. | `POST /adsets` |
| **2490239** | App do conjunto deve ser o mesmo da campanha. | `POST /adsets` |
| **2490246** | Objetivo deve ser Instalações do App. | `POST /adsets` |
| **2490247** | Permissão para criar campanha iOS 14 indisponível temporariamente. | `POST /adsets` |
| **2490249** | Versão mínima do iOS deve ser 14.0. | `POST /adsets` |
| **2490250** | URL e ID do iTunes obrigatórios. | `POST /adsets` |
| **2490252** | Duração mínima de campanha necessária para limite de custos/ROAS. | `POST /adsets` |
| **2490253** | Versão máxima do iOS excedida. | `POST /adsets` |
| **2490255** | Tipo de compra deve ser Leilão para alcançar iOS 14. | `POST /campaigns` |
| **2490256** | Otimização de cliques no link não suportada. Use Instalações, Eventos ou Valor. | `POST /adsets` |
| **3285004** | Otimização de Valor requer ativação no Gerenciador de Eventos. | `POST /adsets` |
| **3285005** | Otimização de Eventos requer configuração no Gerenciador de Eventos. | `POST /adsets` |
| **3285006** | Evento de conversão não configurado. | `POST /adsets` |
| **3285007** | Suporte a MMP de terceiros em andamento. | `POST /adsets`, `POST /campaigns` |
| **3285008** | Deep links diferidos não disponíveis. | `POST /ads` |
| **3285009** | Otimização de eventos deve ser igual em todos os conjuntos. | `POST /adsets` |
| **3285010** | Verificação de propriedade do app necessária. | `POST /campaigns` |
| **3260002** | Domínios devem estar associados a par de eventos de pixel. | `POST /ads` |
| **3260007** | Evento não configurado no domínio. | `POST /adsets` |
| **3260008** | Anúncio pausado por atualização recente de eventos (72h de espera). | `POST /ads` |

## Recursos Adicionais
*   [Central de Ajuda para Empresas: Anúncios e iOS 14.5+](https://www.facebook.com/business/help)
*   [Central de Ajuda para Empresas: Integração SKAdNetwork](https://www.facebook.com/business/help)
