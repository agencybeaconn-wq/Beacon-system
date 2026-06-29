import { supabase } from "@/integrations/supabase/client";

/**
 * BriefingAutomationService
 * Generates implementation tasks automatically from briefing answers.
 * Replaces product-based task generation with briefing-driven tasks.
 */

// Team member emails → area mapping
const AREA_EMAILS: Record<string, string> = {
  design: 'flpcampanhaxv@gmail.com',
  dev: 'pedrinholoco93@gmail.com',
  gestao: 'joaogestao.tlc@gmail.com',
  trafego: 'wesleygamafl@gmail.com',
};

interface TaskTemplate {
  title: string;
  area: string;
  phase: string;
  phaseOrder: number;
  checklist?: { id: string; title: string; isCompleted: boolean }[];
  condition?: (answers: Record<string, any>) => boolean;
  buildTitle?: (answers: Record<string, any>) => string;
  buildChecklist?: (answers: Record<string, any>) => { id: string; title: string; isCompleted: boolean }[];
  // Override manual do responsável (por email). Se vazio, usa o mapping de AREA_EMAILS.
  assigneeEmailOverride?: string;
  // Prazo em dias após o briefing ser preenchido. Se vazio, sem prazo.
  dueDaysAfterBriefing?: number;
}

function uuid() {
  return crypto.randomUUID();
}

function buildTaskTemplates(): TaskTemplate[] {
  return [
    // ─── FASE 1: IDENTIDADE VISUAL ──────────────
    // Banners são pacote fixo da agência (Capa de coleção 4x + Home 6x).
    // Conceito visual fica em `banners_conceito` (texto livre), exibido na task pro design seguir.
    {
      title: 'Criar banners',
      area: 'design',
      phase: 'Identidade Visual',
      phaseOrder: 1,
      buildChecklist: (a) => {
        const items: any[] = [
          { id: uuid(), title: 'Capa de coleção — Masculino', isCompleted: false },
          { id: uuid(), title: 'Capa de coleção — Feminino', isCompleted: false },
          { id: uuid(), title: 'Capa de coleção — Infantil', isCompleted: false },
          { id: uuid(), title: 'Capa de coleção — Retrô', isCompleted: false },
          { id: uuid(), title: 'Home — Institucional (slogan)', isCompleted: false },
          { id: uuid(), title: 'Home — Oferta', isCompleted: false },
          { id: uuid(), title: 'Home — Camisas Brasil', isCompleted: false },
          { id: uuid(), title: 'Home — Geral Copa', isCompleted: false },
          { id: uuid(), title: 'Home — Copy', isCompleted: false },
          { id: uuid(), title: 'Home — Rotativo', isCompleted: false },
        ];
        if (a.banners_conceito && typeof a.banners_conceito === 'string' && a.banners_conceito.trim()) {
          items.push({ id: uuid(), title: `Conceito do cliente: ${a.banners_conceito.trim().substring(0, 120)}`, isCompleted: false });
        }
        items.push({ id: uuid(), title: 'Subir banners no Drive do cliente', isCompleted: false });
        return items;
      },
    },

    // ─── FASE 2: IMPLEMENTAÇÃO SHOPIFY ──────────
    {
      title: 'Conectar Shopify e importar tema Lever',
      area: 'dev',
      phase: 'Implementação Shopify',
      phaseOrder: 2,
      checklist: [
        { id: uuid(), title: 'Instalar app Lever no Shopify Partners', isCompleted: false },
        { id: uuid(), title: 'Conectar loja no sistema (Conexões > Shopify)', isCompleted: false },
        { id: uuid(), title: 'Importar tema Lever (.zip) na loja', isCompleted: false },
      ],
    },
    {
      title: 'Configurar licença, tema e contato',
      area: 'dev',
      phase: 'Implementação Shopify',
      phaseOrder: 2,
      buildChecklist: (a) => {
        // Paleta: se cliente anexou imagem de referência, orienta o designer a usá-la.
        const paletaLine = a.paleta_imagem_url
          ? { id: uuid(), title: 'Aplicar paleta conforme imagem de referência enviada no briefing', isCompleted: false }
          : { id: uuid(), title: 'Revisar e aplicar paleta de cores', isCompleted: false };

        const items = [
          { id: uuid(), title: 'Criar e ativar licença do tema', isCompleted: false },
          { id: uuid(), title: 'Configurar email e telefone no header/footer', isCompleted: false },
          { id: uuid(), title: 'Configurar redes sociais', isCompleted: false },
          { id: uuid(), title: 'Configurar announcement bar', isCompleted: false },
          { id: uuid(), title: 'Subir logo, favicon e banners no Shopify Files', isCompleted: false },
          { id: uuid(), title: 'Inserir logo e favicon no tema', isCompleted: false },
          { id: uuid(), title: 'Inserir banners nas seções do tema', isCompleted: false },
          paletaLine,
        ];
        if (a.frete_gratis === 'Sim' || a.frete_gratis === true) {
          const valor = typeof a.frete_gratis_valor === 'string' ? a.frete_gratis_valor.trim() : String(a.frete_gratis_valor || '').trim();
          items.push({
            id: uuid(),
            title: valor
              ? `Configurar frete grátis acima de R$${valor}`
              : 'Configurar regra de frete grátis (valor a definir com cliente)',
            isCompleted: false,
          });
        }
        return items;
      },
    },
    {
      // 3 ramificações baseadas em `usar_nossos_produtos` + `manter_precos_atuais`.
      // Path "Sim" ou undefined (legado) preserva exatamente a checklist original.
      title: 'Importar produtos e configurar preços',
      area: 'dev',
      phase: 'Implementação Shopify',
      phaseOrder: 2,
      buildTitle: (a) => {
        if (a.usar_nossos_produtos === 'Não' && a.manter_precos_atuais === 'Sim') {
          return 'Subir produtos próprios (preservar preços atuais)';
        }
        if (a.usar_nossos_produtos === 'Não') {
          return 'Subir produtos próprios do cliente';
        }
        return 'Importar produtos e configurar preços';
      },
      buildChecklist: (a) => {
        if (a.usar_nossos_produtos === 'Não' && a.manter_precos_atuais === 'Sim') {
          return [
            { id: uuid(), title: 'Subir produtos do cliente (fotos, variantes, SKUs)', isCompleted: false },
            { id: uuid(), title: 'Preservar preços atuais — NÃO sobrescrever', isCompleted: false },
            { id: uuid(), title: 'Verificar descrições e metadados', isCompleted: false },
            { id: uuid(), title: 'Organizar produtos em coleções', isCompleted: false },
          ];
        }
        if (a.usar_nossos_produtos === 'Não') {
          return [
            { id: uuid(), title: 'Subir produtos do cliente (fotos, variantes, SKUs)', isCompleted: false },
            { id: uuid(), title: 'Aplicar preços novos conforme briefing', isCompleted: false },
            { id: uuid(), title: 'Verificar descrições e metadados', isCompleted: false },
            { id: uuid(), title: 'Organizar produtos em coleções', isCompleted: false },
          ];
        }
        // Path default (Sim ou undefined/legado) — comportamento original preservado.
        return [
          { id: uuid(), title: 'Importar produtos da loja template', isCompleted: false },
          { id: uuid(), title: 'Configurar preços por categoria', isCompleted: false },
          { id: uuid(), title: 'Verificar imagens e descrições', isCompleted: false },
          { id: uuid(), title: 'Ordenar produtos nas coleções', isCompleted: false },
        ];
      },
    },
    {
      title: 'Importar coleções e menus',
      area: 'dev',
      phase: 'Implementação Shopify',
      phaseOrder: 2,
      checklist: [
        { id: uuid(), title: 'Importar coleções da template', isCompleted: false },
        { id: uuid(), title: 'Configurar menu principal com times', isCompleted: false },
        { id: uuid(), title: 'Configurar menu do rodapé', isCompleted: false },
        { id: uuid(), title: 'Verificar links dos menus', isCompleted: false },
      ],
    },
    {
      // 3 paths baseados em `politicas_opcao`. Default (undefined/legado) = criar novas.
      title: 'Criar e adaptar páginas (políticas, FAQ, sobre)',
      area: 'dev',
      phase: 'Implementação Shopify',
      phaseOrder: 2,
      buildTitle: (a) => {
        if (a.politicas_opcao === 'Usar as atuais do cliente') return 'Publicar páginas atuais do cliente';
        if (a.politicas_opcao === 'Adaptar as atuais') return 'Adaptar páginas atuais do cliente';
        return 'Criar e adaptar páginas (políticas, FAQ, sobre)';
      },
      buildChecklist: (a) => {
        if (a.politicas_opcao === 'Usar as atuais do cliente') {
          return [
            { id: uuid(), title: 'Importar/replicar páginas do site atual', isCompleted: false },
            { id: uuid(), title: 'Verificar links e formatação no tema', isCompleted: false },
            { id: uuid(), title: 'Configurar página de Rastreio', isCompleted: false },
            { id: uuid(), title: 'Testar responsividade', isCompleted: false },
          ];
        }
        if (a.politicas_opcao === 'Adaptar as atuais') {
          const ajustes = typeof a.politicas_adaptar === 'string' && a.politicas_adaptar.trim()
            ? a.politicas_adaptar.trim().substring(0, 120)
            : 'a definir com cliente';
          return [
            { id: uuid(), title: 'Importar páginas atuais do cliente', isCompleted: false },
            { id: uuid(), title: `Aplicar ajustes solicitados: ${ajustes}`, isCompleted: false },
            { id: uuid(), title: 'Configurar página de Rastreio', isCompleted: false },
            { id: uuid(), title: 'Revisar com cliente', isCompleted: false },
          ];
        }
        // Default (Criar novas ou legado) — preserva checklist original.
        return [
          { id: uuid(), title: 'Criar página Sobre Nós', isCompleted: false },
          { id: uuid(), title: 'Criar página FAQ', isCompleted: false },
          { id: uuid(), title: 'Criar página Trocas e Devoluções', isCompleted: false },
          { id: uuid(), title: 'Criar página Envios e Prazos', isCompleted: false },
          { id: uuid(), title: 'Criar página Compra Segura', isCompleted: false },
          { id: uuid(), title: 'Configurar página de Rastreio', isCompleted: false },
        ];
      },
    },
    {
      title: 'Configurar parcelamento',
      area: 'dev',
      phase: 'Implementação Shopify',
      phaseOrder: 2,
      condition: (a) => a.parcelamento === true || a.parcelamento === 'sim',
      buildTitle: (a) => `Configurar parcelamento até ${a.parcelas_max || '12'}x`,
    },

    // ─── FASE 4: PROMOÇÕES E OFERTAS ────────────
    {
      title: 'Configurar promoções no carrinho',
      area: 'dev',
      phase: 'Promoções e Ofertas',
      phaseOrder: 3,
      condition: (a) => {
        const ofertas = a.ofertas || [];
        return Array.isArray(ofertas) && ofertas.length > 0;
      },
      buildChecklist: (a) => {
        const ofertas = a.ofertas || [];
        const items = ofertas.map((oferta: string) => ({
          id: uuid(),
          title: `Configurar: ${oferta}`,
          isCompleted: false,
        }));
        items.push({ id: uuid(), title: 'Configurar milestones no carrinho', isCompleted: false });
        items.push({ id: uuid(), title: 'Configurar mensagens do carrinho', isCompleted: false });
        items.push({ id: uuid(), title: 'Testar promoções', isCompleted: false });
        return items;
      },
    },
    {
      title: 'Implementar ofertas customizadas',
      area: 'dev',
      phase: 'Promoções e Ofertas',
      phaseOrder: 3,
      condition: (a) => !!a.ofertas_descricao && a.ofertas_descricao.trim().length > 0,
      buildTitle: (a) => `Implementar ofertas: ${(a.ofertas_descricao || '').substring(0, 60)}`,
    },

    // ─── FASE 4: AUTOMAÇÕES & RETENÇÃO (condicional) ──────────
    {
      title: 'Implementação de Automações (Email e WhatsApp)',
      area: 'gestao',
      phase: 'Automações & Retenção',
      phaseOrder: 4,
      assigneeEmailOverride: 'flpcampanhaxv@gmail.com', // Felipe Campanã
      condition: (a) => a.usar_automacoes === 'Sim',
      checklist: [
        { id: uuid(), title: 'Verificação do Email Profissional', isCompleted: false },
        { id: uuid(), title: 'Criação e implementação do WhatsApp API', isCompleted: false },
        { id: uuid(), title: 'Importação da estrutura de automações de Email', isCompleted: false },
        { id: uuid(), title: 'Importação da estrutura de automações de WhatsApp', isCompleted: false },
        { id: uuid(), title: 'Personalização das mensagens conforme padrão visual do cliente', isCompleted: false },
        { id: uuid(), title: 'Enviar mensagens do WhatsApp API para aprovação', isCompleted: false },
        { id: uuid(), title: 'Verificar aprovação das mensagens', isCompleted: false },
      ],
    },

    // ─── FASE 6: REVISÃO FINAL ──────────────────
    {
      title: 'Revisão geral da loja',
      area: 'gestao',
      phase: 'Revisão Final',
      phaseOrder: 5,
      assigneeEmailOverride: 'flpcampanhaxv@gmail.com', // Felipe Campanã — fase final é dele
      dueDaysAfterBriefing: 20,
      checklist: [
        { id: uuid(), title: 'Revisar todos os produtos e preços', isCompleted: false },
        { id: uuid(), title: 'Revisar páginas e políticas', isCompleted: false },
        { id: uuid(), title: 'Revisar menus e navegação', isCompleted: false },
        { id: uuid(), title: 'Revisar tema e identidade visual', isCompleted: false },
        { id: uuid(), title: 'Testar checkout e pagamento', isCompleted: false },
        { id: uuid(), title: 'Testar responsividade mobile', isCompleted: false },
      ],
    },
    {
      title: 'Aprovação do cliente',
      area: 'gestao',
      phase: 'Revisão Final',
      phaseOrder: 5,
      assigneeEmailOverride: 'flpcampanhaxv@gmail.com', // Felipe Campanã — fase final é dele
      dueDaysAfterBriefing: 20,
      checklist: [
        { id: uuid(), title: 'Enviar loja para revisão do cliente', isCompleted: false },
        { id: uuid(), title: 'Coletar feedback', isCompleted: false },
        { id: uuid(), title: 'Aplicar ajustes solicitados', isCompleted: false },
        { id: uuid(), title: 'Aprovação final', isCompleted: false },
      ],
    },
  ];
}

export const BriefingAutomationService = {
  async generateTasksFromBriefing(clientId: string, briefingId: string, workspaceId: string, force: boolean = false) {
    console.log(`[BriefingAutomation] Generating tasks for client ${clientId} from briefing ${briefingId}`);

    // 1. Fetch briefing answers
    const { data: briefing, error: briefingError } = await (supabase as any)
      .from('briefings')
      .select('answers')
      .eq('id', briefingId)
      .single();

    if (briefingError || !briefing) {
      console.error('[BriefingAutomation] Error fetching briefing:', briefingError);
      return { error: 'Briefing not found' };
    }

    const answers = briefing.answers || {};

    // 2. Check if tasks already exist for this briefing (prevent duplicates)
    const { data: existingTasks } = await (supabase as any)
      .from('client_tasks')
      .select('id')
      .eq('client_id', clientId)
      .eq('source', 'briefing');

    if (existingTasks && existingTasks.length > 0) {
      if (force) {
        // Force mode: delete existing tasks before re-generating
        console.log(`[BriefingAutomation] Force mode: deleting ${existingTasks.length} existing tasks`);
        const ids = existingTasks.map((t: any) => t.id);
        await (supabase as any)
          .from('client_tasks')
          .delete()
          .in('id', ids);
      } else {
        console.log('[BriefingAutomation] Tasks already exist for this briefing, skipping');
        return { data: existingTasks, skipped: true };
      }
    }

    // 3. Get team member mapping (email → user_id). Busca área + overrides num único fetch.
    const { data: members } = await (supabase as any)
      .from('team_members')
      .select('id, user_id, email');

    const emailToUserId = new Map<string, string | null>();
    for (const m of (members || [])) {
      if (m.email) emailToUserId.set(m.email, m.user_id || null);
    }

    const areaToUserId: Record<string, string | null> = {};
    for (const [area, email] of Object.entries(AREA_EMAILS)) {
      areaToUserId[area] = emailToUserId.get(email) || null;
    }
    console.log('[BriefingAutomation] Area → User mapping:', areaToUserId);

    // Momento em que o briefing está sendo processado = referência pros prazos (`dueDaysAfterBriefing`).
    const briefingSubmittedAt = new Date();

    // 4. Build tasks from templates
    const templates = buildTaskTemplates();
    const tasksToInsert = [];
    let orderPosition = 0;

    for (const template of templates) {
      // Check condition
      if (template.condition && !template.condition(answers)) {
        continue;
      }

      const title = template.buildTitle ? template.buildTitle(answers) : template.title;
      const checklist = template.buildChecklist
        ? template.buildChecklist(answers)
        : (template.checklist || []);

      // Override manual de responsável tem prioridade sobre mapping por área.
      const assigneeId = template.assigneeEmailOverride
        ? emailToUserId.get(template.assigneeEmailOverride) || areaToUserId[template.area] || null
        : areaToUserId[template.area] || null;

      // Prazo: briefing + N dias. Default = 5 dias (placeholder até integração com prazos do onboarding).
      // Templates podem sobrescrever individualmente (ex: Revisão/Aprovação = 20 dias).
      // Armazenado como DATE (YYYY-MM-DD) pra bater com o schema.
      const dueDays = template.dueDaysAfterBriefing && template.dueDaysAfterBriefing > 0
        ? template.dueDaysAfterBriefing
        : 5;
      const dueDateObj = new Date(briefingSubmittedAt.getTime() + dueDays * 86400000);
      const dueDate = `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth() + 1).padStart(2, '0')}-${String(dueDateObj.getDate()).padStart(2, '0')}`;

      tasksToInsert.push({
        client_id: clientId,
        workspace_id: workspaceId,
        title,
        description: `Fase: ${template.phase}`,
        status: 'todo',
        priority: template.phaseOrder <= 1 ? 'high' : 'medium',
        category: template.phase,
        area: template.area,
        assignee_id: assigneeId,
        due_date: dueDate,
        step_id: `briefing-${briefingId}-step-${orderPosition}`,
        checklist,
        order_position: orderPosition,
        source: 'briefing',
        created_at: briefingSubmittedAt.toISOString(),
      });
      orderPosition++;
    }

    console.log(`[BriefingAutomation] Generated ${tasksToInsert.length} tasks`);

    // 5. Insert tasks
    let { data, error } = await supabase
      .from('client_tasks')
      .insert(tasksToInsert)
      .select();

    // Fallback without assignees if FK error
    if (error) {
      console.warn('[BriefingAutomation] Error with assignees, retrying without:', error);
      const tasksWithoutAssignees = tasksToInsert.map(t => ({ ...t, assignee_id: null }));
      const retry = await supabase.from('client_tasks').insert(tasksWithoutAssignees).select();
      data = retry.data;
      error = retry.error;

      if (error) {
        console.error('[BriefingAutomation] Fatal error:', error);
        return { error };
      }
    }

    console.log(`[BriefingAutomation] Created ${(data || []).length} tasks successfully`);
    return { data };
  },
};
