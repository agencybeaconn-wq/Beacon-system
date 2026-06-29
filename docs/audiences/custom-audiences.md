# Públicos Personalizados (Custom Audiences)

Os Públicos Personalizados permitem segmentar usuários com base em dados próprios (CRM, site, app) ou engajamento no Facebook/Instagram.

> **Aviso Importante (Setembro 2025):** Restrições proativas serão aplicadas a públicos que sugiram condições de saúde ou status financeiro. O `operation_status` retornará `471` se o público for sinalizado.

## Permissões
Requer a permissão `ads_management`.

## Tipos de Público

### 1. Arquivo de Cliente (Customer File)
Baseado em dados de CRM (email, telefone, IDs).
- **Identificadores:** Email, Phone, Name, DOB, Gender, Location, App UID, Page Scoped UID, Apple IDFA, Android Ad ID.

### 2. Engajamento
Baseado em interações com conteúdo.
- **Fontes:** Página Facebook, Perfil Instagram Business, Formulários de Lead, Instant Experiences.

### 3. App para Celular
Baseado em eventos de app (SDK do Facebook ou API de Eventos).

### 4. Site (Website)
Baseado em tráfego e ações no site (Pixel do Facebook, API de Conversões).

### 5. Offline
Baseado em eventos offline (visitas à loja, chamadas) carregados em um Conjunto de Eventos Offline.

### 6. Públicos Dinâmicos
Baseado em intenção de compra (sinais de app/site) para atingir clientes em potencial.

### 7. Públicos Semelhantes (Lookalike)
Atinge pessoas parecidas com um público "semente" (ex: seus melhores clientes).

## Gerenciamento e Ciclo de Vida

### Compartilhamento
É possível compartilhar públicos com outras contas (Business Manager) usando APIs de Funções entre empresas.

### Expiração e Exclusão Automática
- **Política:** Públicos não usados em conjuntos de anúncios ativos por **mais de 2 anos** recebem status `EXPIRING`.
- **Exclusão:** Após 90 dias no estado `EXPIRING`, o público é excluído.
- **Prevenção:** Usar o público em um conjunto ativo renova sua validade. Para listas de clientes, a ação de usar é interpretada como instrução para manter; não usar é instrução para excluir.

## Endpoints da API

### Obter Detalhes do Público
```bash
GET /{CUSTOM_AUDIENCE_ID}
```
**Campos Relevantes:**
- `operation_status`: Contém código `100` e descrição se estiver expirando.
- `delete_time`: Timestamp Unix da data de exclusão programada.

### Listar Públicos da Conta (com Filtros de Expiração)
Filtrar por públicos que estão expirando ou têm data de exclusão definida.

```bash
GET /act_{AD_ACCOUNT_ID}/customaudiences?filtering=[{"field":"delete_time","operator":"GREATER_THAN","value":0}]&fields=["name","operation_status","delete_time"]
```

### Listar Públicos Salvos (Saved Audiences)
Também sujeitos à política de expiração.

```bash
GET /act_{AD_ACCOUNT_ID}/saved_audiences?filtering=[{"field":"delete_time","operator":"GREATER_THAN","value":0}]
```
