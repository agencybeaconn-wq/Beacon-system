# Controle de Versões da API de Marketing

A versão atual da API de Marketing é **v24.0**.

A plataforma do Facebook tem um modelo de controle de versões principal e um ampliado. Com o controle de versões da API de Marketing, todas as alterações importantes serão lançadas em uma nova versão. As diversas versões das APIs de Marketing ou dos SDKs podem coexistir com funcionalidades diferentes em cada versão.

Os desenvolvedores devem saber com antecedência quando uma API de Marketing ou um SDK sofrerá alterações. Embora haja uma janela de 90 dias para adotar as alterações, a escolha de como e quando passar para a nova versão é sua.

## Cronograma de versões

Quando uma nova versão da API de Marketing é lançada, mantemos a compatibilidade com a versão anterior por pelo menos **90 dias**. Isso significa que você terá esse período de carência para atualizar sua versão. Durante esses 90 dias, você poderá fazer chamadas para a versão atual e a obsoleta. Depois desse prazo, será necessário atualizar para a nova versão. Ao término do período de carência, a versão obsoleta deixará de funcionar.

Por exemplo, a API de Marketing v17.0 foi lançada em 23 de maio de 2023, e a v16.0 expirou em 6 de fevereiro de 2024.

No caso dos SDKs, uma versão está sempre disponível no estado atual como um pacote para download. Depois do fim de vida útil, o SDK continuará se baseando nas APIs de Marketing ou em métodos que não funcionam mais.

## Como fazer solicitações de controle de versões

Todos os pontos de extremidade da API de Marketing estão disponíveis por meio de um caminho com controle de versões. Pré-anexe o identificador de versão no início do caminho da solicitação.

**Formato:**
`https://graph.facebook.com/v{n}/{request-path}`

**Exemplo:**
```bash
curl -G \
-d "access_token=<ACCESS_TOKEN>" \
"https://graph.facebook.com/v24.0/me/adaccounts"
```

## Migrações

As migrações são somente para casos especiais, nos quais as alterações que precisam ser feitas não podem entrar no controle de versões (ex: alteração no modelo de dados básicos). Migrações aplicam-se a todas as versões.

### Como gerenciar migrações
- **Via Graph API:** Através do campo `migrations` do nó `/app`.
- **Via Painel de Apps:** Em Configurações > Migrações.
- **Ativação temporária (lado do cliente):** Usando a flag `migrations_override`.

Exemplo de override:
```
http://graph.facebook.com/path?migrations_override={"migration1":true, "migration2":false}
```

## Atualização automática da versão

Devido à rápida rotatividade das versões (aprox. a cada 4 meses), estamos simplificando o processo. A partir de maio de 2024, habilitaremos a atualização automática para pontos de extremidade não afetados entre versões.

Isso significa que, se você chamar uma versão obsoleta para um endpoint que NÃO mudou na nova versão, a plataforma atualizará a chamada automaticamente em vez de falhar.

**Exceção:** Se o endpoint foi afetado (mudou), a chamada falhará e exigirá atualização manual.
