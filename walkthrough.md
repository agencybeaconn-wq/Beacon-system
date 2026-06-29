# Walkthrough - Separação de Funções e Níveis de Acesso

Implementamos uma separação clara entre **Funções de Trabalho** (tarefas/competências) e **Níveis de Acesso** (permissões do sistema).

## O que mudou?

### 1. CRM: Clareza Visual e Gestão Dinâmica 🚀

Implementamos uma série de melhorias no CRM para tornar a gestão de leads mais intuitiva e flexível.

- **Cores Distintas:** Substituímos os gradientes similares por cores sólidas e vibrantes (Vermelho para **Quente**, Âmbar para **Morno** e Azul para **Frio**), facilitando a identificação imediata do status do lead.
- **Modal de Lead Aprimorado:** A seção de **Histórico & Observações** agora ocupa toda a largura do modal e possui uma altura expandida (300px+), proporcionando muito mais espaço para leitura e escrita de detalhes da negociação.
- **Colunas Dinâmicas:** Agora você pode adicionar e excluir colunas diretamente no Kanban! Cada workspace agora tem suas próprias etapas de funil personalizáveis.
- **Links Rápidos:** Integração direta com WhatsApp e Site do cliente dentro do modal.

### 2. Interface de Gestão (TeamConnections)
Agora existem dois fluxos de gestão independentes no topo da página de Equipe:
- **Criar Função**: Abre o modal para definir nomes de cargos e suas competências.
- **Níveis de Acesso**: Abre um gerenciador para definir perfis de permissão.
*A interface foi limpa para remover botões duplicados e organizar o cabeçalho.*

### Conexão WhatsApp 📱
- **Fluxos Suportados**: 
  - **QR Code**: Conexão rápida via escaneamento.
  - **Código de Pareamento (Novidade!)**: Conexão via número de telefone, mais estável para versões da EvolutionAPI com problemas de rendering de imagem.
- **Segurança**: Edge Function configurada com persistência no banco de dados e controle de sessão Supabase.

---

### Central de Mensagens 💬
- Interface moderna estilo WhatsApp Web.
- Sincronização em tempo real das conversas.
- Navegação integrada através do menu lateral.

---

### Solução de Problemas (Debug)
- **Erro 401**: Resolvido com deploy forçado (`--no-verify-jwt`) e validação de sessão em cada chamada.
- **QR Code Inválido**: Substituído pela opção de Código de Pareamento por ser 100% legível em qualquer dispositivo.

---

### Próximos Passos
1. **Configurar Webhooks**: Para habilitar o recebimento de mensagens em tempo real (Push).
2. **Upgrade de Versão**: Considerar migrar a EvolutionAPI para v2.3.0+ caso a estabilidade total seja necessária.

### 2. Clientes Arquivados (Settings)
- As ações de **Desarquivar** e **Excluir** foram agrupadas no final da linha.
- O botão de exclusão agora é apenas um ícone de lixeira, tornando o layout mais compacto.

### 2. Edição de Membros (EditMemberModal)
O modal de edição foi totalmente reformulado para permitir que um membro tenha:
- 1 Nível de Acesso Nativo (Admin, Operator, Restricted).
- Múltiplos **Níveis de Acesso** customizados (ampliando permissões).
- Múltiplos **Funções de Trabalho** (identificando suas responsabilidades).

### 3. Banco de Dados
Novas tabelas foram criadas para suportar essa estrutura:
- `agency_access_levels`: Armazena as configurações de permissão (`permissions_config`).
- `member_access_levels`: Tabela de junção vinculando membros aos seus níveis de acesso.
- `agency_roles`: Agora focada exclusivamente em `name` e `permissions` (competências).

## Como Testar?

1. Acesse a página **Equipe**.
2. Clique em **Níveis de Acesso** e crie um novo perfil configurando a matriz de permissões.
3. Clique em **Criar Função** e adicione um cargo com competências específicas.
4. No botão **Editar** de um membro existente:
    - Selecione um ou mais **Níveis de Acesso**.
    - Selecione uma ou mais **Funções de Trabalho**.
    - Clique em **Salvar**.

## Verificação Técnica
- [x] RLS habilitado nas novas tabelas.
- [x] Hooks `useAccessLevels` e `useAgencyRoles` funcionando de forma independente.
- [x] Linting e sintaxe JSX validados.
