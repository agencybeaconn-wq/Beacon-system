
- [x] **Estado Inicial (Minimizado)**
    - [x] Set defaultExpanded={false} for 'All' filter in Products.tsx
- [x] **Gestão de Equipe: Separação de Funções e Níveis de Acesso**
    - [x] **DB Setup**: Criado `agency_access_levels` e `member_access_levels`.
    - [x] Criado hook `useAccessLevels` para gestão de permissões.
    - [x] Refatorado `useAgencyRoles` para focar em Funções de Trabalho (Competências).
    - [x] Criado `CreateAccessLevelModal` com matriz de permissões.
    - [x] Refatorado `CreateRoleModal` para gestão simplificada de Funções.
    - [x] CRM UI & Logic Enhancements
        - [x] Re-adjust Lead score colors (make them more distinct and less "loud")
        - [x] Enhance "Observações" section in Lead Modal (larger and better readability)
        - [x] Implement Dynamic Kanban Columns (Add/Delete functionality)
        - [/] CRM Final Refinements
            - [x] Implement Column Reordering (Drag and Drop columns)
            - [/] Antagonistic Colors Overhaul (Maximum contrast)
                - [ ] Define high-contrast palette (e.g. Neon Red, Bright Yellow/Gold, Deep Cyan/Blue)
                - [ ] Apply colors to Card Headers, Type labels, and Badges
                - [ ] Sync LeadModal selection colors with the new antagonistic theme
            - [x] Redesign Lead Card for a more premium look
            - [x] Replace browser `prompt` with internal UI for column management
    - [x] Atualizado `TeamConnections`:
        - [x] UI com dois botões distintos: "Criar Função" e "Níveis de Acesso".
        - [x] Seções de visualização separadas para Funções e Níveis.
    - [x] Atualizado `EditMemberModal`:
       ## 3. Backend & Integração EvolutionAPI
- [x] Criar Edge Function `whatsapp-evolution` no Supabase [EXECUTION]
- [x] Implementar endpoint para criar/conectar instância [EXECUTION]
- [x] Implementar endpoint para buscar QR Code em tempo real [EXECUTION]
- [x] Implementar endpoint para Código de Pareamento (Pairing Code) [EXECUTION]
- [x] Obter `AUTHENTICATION_API_KEY` da EvolutionAPI (Hetzner Rescue) [PLANNING]
- [x] Configurar Secrets no Supabase (`EVOLUTION_API_URL` e `EVOLUTION_API_KEY`) [EXECUTION]
- [x] Fazer deploy da Edge Function `whatsapp-evolution` com suporte a Código [EXECUTION]
- [ ] Configurar Webhooks para receber mensagens no Supabase [EXECUTION]
- [x] Salvar estados de conexão no banco de dados [EXECUTION]

## 4. Validação
- [x] Validar fluxo visual de conexão QR Code [VERIFICATION]
- [x] Implementar opção de Conexão via Número (Pairing Code) [EXECUTION]
- [ ] Validar navegação e interface do Chat [VERIFICATION]
- [x] **Fluxo de Convite de Membros**
    - [x] Criar Edge Function `send-invite` para envio de e-mails.
    - [x] Criar página `AcceptInvite.tsx`.
    - [x] Adicionar rota `/auth/accept-invite` ao `App.tsx`.
    - [x] Interceptar tokens de convite no `DeepLinkHandler`.
    - [x] Atualizar status do membro para 'active' após definir senha.
- [x] **Sincronização de Status de Membros**
    - [x] Atualizar Edge Function para detectar usuários existentes.
    - [x] Atualizar `AcceptInvite.tsx` para redundância.
    - [x] Criar script SQL para trigger e correção retroativa.
- [ ] **Exibição de Demandas por Role da Equipe (Opcional)**
  - Atualmente os funcionários só veem demandas nas quais são marcados como responsáveis diretos (Assignee). Quer que o sistema exiba as do Setor de forma automática (Role)?

[ ] **Sistema de Menções nas Demandas (Opcional)**
  - Avaliar a criação de um sistema para marcar `@funcionario` nos comentários ou descrição, notificando-o em sua interface.

[x] **Corrigir Modal de Convite de Equipe**
  - [x] Garantir que o campo "Nome" apareça no modal (está no código mas usuário não vê).
  - [x] Adicionar traduções para PT-BR no `translation.json`.
  - [x] Corrigir bug do dropdown que fecha o modal ao selecionar setor.
  - [x] Passar `name` e `sector` na chamada do Supabase Function `invite-team-member`.
- [x] **Aprimoramento de Gestão de Equipe e Arquivamento**
    - [x] Botão de excluir em itens arquivados.
    - [x] Novo sistema de Roles com matriz de permissões.
    - [x] Botão dedicado "Níveis de Acesso" na Equipe.
    - [x] Edição de Roles e Atribuição a funcionários.
- [x] **Testar fluxo completo.**
