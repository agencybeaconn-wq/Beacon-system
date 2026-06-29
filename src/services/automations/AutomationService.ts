
import { supabase } from "@/integrations/supabase/client";
import { AgencyProduct } from "@/hooks/useAgencyProducts";
import { Task } from "@/types/lever-os";

/**
 * AutomationService
 * Responsável por lógica de automação entre módulos (Etapa 2 e 5)
 */
export const AutomationService = {
    /**
     * Instancia processos de um produto para um cliente específico no Kanban
     */
    async instantiateProductTasks(clientId: string, product: AgencyProduct, workspaceId: string) {
        if (!clientId || !product || !workspaceId) {
            console.error("[AutomationService] Missing required data for instantiation");
            return { error: "Missing data" };
        }

        console.log(`[AutomationService] Instantiating tasks for product: ${product.name} (Client: ${clientId})`);

        // Translate team_members.id → auth.users(id) for assignee_id
        // agency_product_features.assigned_member_id references team_members.id
        // but client_tasks.assignee_id references auth.users(id)
        const memberIds = (product.features || [])
            .map(f => f.assigned_member_id)
            .filter(Boolean) as string[];

        let memberIdToUserId: Record<string, string> = {};
        if (memberIds.length > 0) {
            const { data: members } = await (supabase as any)
                .from('team_members')
                .select('id, user_id')
                .in('id', memberIds);

            if (members) {
                for (const m of members) {
                    if (m.user_id) {
                        memberIdToUserId[m.id] = m.user_id;
                    }
                }
            }
            console.log('[AutomationService] Member ID → User ID mapping:', memberIdToUserId);
        }

        // Determine which group is the "first" group to set initial task status
        const groups = product.groups || [];
        const firstGroupId = groups.length > 0 ? groups[0].id : null;

        // Converter features do produto em tarefas do Kanban
        const tasksToInsert = (product.features || []).map((feature, index) => {
            const featureCategory = feature.category || 'Geral';
            const isFirstGroup = firstGroupId ? featureCategory === firstGroupId : index === 0;

            return {
                client_id: clientId,
                workspace_id: workspaceId,
                title: feature.name,
                description: `Executável do produto "${product.name}" para o cliente`,
                // First group tasks are 'todo', later groups are 'backlog' (locked)
                status: isFirstGroup ? 'todo' : 'backlog',
                priority: index === 0 ? 'high' : 'medium',
                category: featureCategory,
                product_id: product.id,
                product_name: product.name,
                order_position: index,
                // Translate team_members.id to auth.users(id) — assign in ALL phases
                assignee_id: feature.assigned_member_id
                    ? (memberIdToUserId[feature.assigned_member_id] || null)
                    : null,
                // Link para a timeline
                step_id: `${product.id}-step-${index}`,
                checklist: (feature.subtasks || []).map(st => ({
                    id: st.id || crypto.randomUUID(),
                    title: st.title,
                    isCompleted: st.completed || false
                })),
                created_at: new Date().toISOString()
            };
        });

        if (tasksToInsert.length === 0) return { data: [] };

        // Verificar se tasks já existem para evitar duplicatas
        const stepIds = tasksToInsert.map(t => t.step_id).filter(Boolean);
        if (stepIds.length > 0) {
            const { data: existing } = await (supabase as any)
                .from('client_tasks')
                .select('step_id')
                .eq('client_id', clientId)
                .in('step_id', stepIds);

            if (existing && existing.length > 0) {
                const existingStepIds = new Set(existing.map((t: any) => t.step_id));
                const newTasks = tasksToInsert.filter(t => !existingStepIds.has(t.step_id));
                if (newTasks.length === 0) {
                    console.log('[AutomationService] Todas as tasks já existem, pulando inserção');
                    return { data: existing, skipped: true };
                }
                // Inserir apenas as novas
                tasksToInsert.splice(0, tasksToInsert.length, ...newTasks);
            }
        }

        let { data, error } = await supabase
            .from('client_tasks')
            .insert(tasksToInsert)
            .select();

        // If it fails (likely due to 409 Foreign Key violation on assignee_id from orphaned users)
        // We fallback to creating tasks without assignees so the system doesn't break
        if (error) {
            console.warn("[AutomationService] Error inserting tasks with assignees. Retrying without assignees. Error:", error);
            const tasksWithoutAssignees = tasksToInsert.map(t => ({ ...t, assignee_id: null }));

            const retryResult = await supabase
                .from('client_tasks')
                .insert(tasksWithoutAssignees)
                .select();

            data = retryResult.data;
            error = retryResult.error;

            if (error) {
                console.error("[AutomationService] Fatal error inserting tasks even without assignees:", error);
                return { error };
            }
        }

        return { data };
    }
};
