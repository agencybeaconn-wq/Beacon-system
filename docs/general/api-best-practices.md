# Boas Práticas da API de Marketing

Diretrizes essenciais para desenvolvimento, manutenção e otimização de integrações com a API de Marketing da Meta.

## Análise de Anúncios (Ad Review)
Alterações que **acionam** uma nova análise:
*   Mudanças no Criativo (imagem, texto, link, vídeo).
*   Mudanças no Direcionamento (Targeting).
*   Mudanças na Meta de Otimização ou Evento de Cobrança.

Alterações que **NÃO acionam** análise:
*   Valor do Lance (Bid Amount).
*   Orçamento (Budget).
*   Programação (Schedule).

> [!NOTE]
> Se um anúncio for editado enquanto estiver "Pausado", ele permanecerá "Pausado" após a aprovação. Caso contrário, ele se tornará "Ativo" automaticamente.

## Requisições em Lote (Batch Requests)
Para otimizar a performance e evitar rate limits, agrupe múltiplas chamadas em uma única requisição HTTP.

**Consultar múltiplos objetos por ID:**
```bash
GET /?ids=[id1,id2]&fields=name,status
```

**Batch Request Complexo:**
Consulte a documentação oficial de Batch Requests para estruturar chamadas dependentes ou independentes em um único payload JSON.

## Modo Sandbox
Ambiente de teste para simular chamadas de API sem gastar dinheiro ou veicular anúncios reais.
*   Permite leitura e escrita.
*   **Limitação:** Não é possível criar anúncios ou criativos visíveis. Use IDs de criativos/anúncios *hardcoded* ou existentes para testar fluxos de leitura/atualização.
*   Útil para demonstrar o app durante o processo de App Review.

## Gerenciamento de Dados e Erros
1.  **ETags:** Use ETags para verificar se os dados mudaram antes de processá-los, economizando banda e processamento.
2.  **Objetos Arquivados/Excluídos:**
    *   Objetos excluídos não aparecem em listagens (edges) de outros objetos.
    *   Consulte diretamente pelo ID para ver objetos arquivados/excluídos.
    *   Arquive objetos antigos para manter a conta limpa (limite de 5k objetos arquivados por vez).
3.  **Tratamento de Erros:** Exiba mensagens de erro claras para o usuário final (ex: "Targeting inválido") baseadas nos códigos de erro da API.

## Lances Sugeridos
Os lances sugeridos (`suggested_bid`) são dinâmicos e mudam com base na concorrência.
*   **Ação:** Atualize esses dados frequentemente em seus relatórios ou interfaces de criação de anúncios.

## Segurança
*   Armazene User IDs, Session Keys e Ad Account IDs de forma associada.
*   Chamadas cruzadas (User ID A tentando acessar Ad Account de User ID B sem permissão) falharão.
