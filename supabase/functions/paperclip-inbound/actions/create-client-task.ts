import { z } from 'https://esm.sh/zod@3.25.76';
import type { ActionDefinition } from './types.ts';

const paramsSchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  area: z.enum(['strategy', 'traffic', 'design', 'dev']).optional(),
  due_date: z.string().datetime().optional(),
  checklist: z
    .array(z.object({ text: z.string().min(1), done: z.boolean().default(false) }))
    .optional(),
  product_id: z.string().optional(),
  product_name: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export const createClientTask: ActionDefinition<Params> = {
  name: 'create_client_task',
  description:
    'Cria uma tarefa (client_tasks) para um cliente. Resolve workspace_id a partir do agency_clients e grava com status=pending.',
  paramsSchema,
  handler: async (params, { supabase, actor }) => {
    // 1. Resolver workspace_id via agency_clients
    const { data: client, error: clientErr } = await supabase
      .from('agency_clients')
      .select('id, workspace_id, name')
      .eq('id', params.client_id)
      .single();

    if (clientErr || !client) {
      throw new Error(`Cliente ${params.client_id} não encontrado`);
    }

    // 2. Montar descrição com rastro do actor (multi-agent → origem)
    const description = [
      params.description ?? '',
      actor ? `\n\n— criado por Paperclip (${actor})` : '\n\n— criado por Paperclip',
    ]
      .filter(Boolean)
      .join('')
      .trim();

    // 3. Inserir task
    const { data: task, error: insertErr } = await supabase
      .from('client_tasks')
      .insert({
        client_id: client.id,
        workspace_id: client.workspace_id,
        title: params.title,
        description,
        status: 'pending',
        priority: params.priority,
        area: params.area ?? null,
        due_date: params.due_date ?? null,
        checklist: params.checklist ?? [],
        product_id: params.product_id ?? null,
        product_name: params.product_name ?? null,
      })
      .select('id, title, status, priority, created_at')
      .single();

    if (insertErr || !task) {
      throw new Error(`Falha ao criar client_task: ${insertErr?.message ?? 'desconhecido'}`);
    }

    return {
      task_id: task.id,
      client_id: client.id,
      client_name: client.name,
      status: task.status,
      priority: task.priority,
      created_at: task.created_at,
    };
  },
};
