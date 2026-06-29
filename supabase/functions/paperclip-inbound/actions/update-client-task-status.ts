import { z } from 'https://esm.sh/zod@3.25.76';
import type { ActionDefinition } from './types.ts';

const paramsSchema = z.object({
  task_id: z.string().uuid(),
  status: z.enum(['pending', 'completed']),
});

type Params = z.infer<typeof paramsSchema>;

export const updateClientTaskStatus: ActionDefinition<Params> = {
  name: 'update_client_task_status',
  description:
    'Atualiza o status de uma client_task para pending|completed. Retorna o registro atualizado.',
  paramsSchema,
  handler: async (params, { supabase }) => {
    const { data, error } = await supabase
      .from('client_tasks')
      .update({ status: params.status, updated_at: new Date().toISOString() })
      .eq('id', params.task_id)
      .select('id, status, title, updated_at')
      .single();

    if (error || !data) {
      throw new Error(`Falha ao atualizar task ${params.task_id}: ${error?.message ?? 'não encontrada'}`);
    }

    return { task: data };
  },
};
