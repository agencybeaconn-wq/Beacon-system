import { z } from 'https://esm.sh/zod@3.25.76';
import type { ActionDefinition } from './types.ts';

const paramsSchema = z.object({
  client_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  name_contains: z.string().min(2).optional(),
}).refine(
  (v) => Boolean(v.client_id || v.email || v.name_contains),
  { message: 'Informe client_id, email ou name_contains' },
);

type Params = z.infer<typeof paramsSchema>;

export const getClientSnapshot: ActionDefinition<Params> = {
  name: 'get_client_snapshot',
  description:
    'Lê um cliente da tabela agency_clients por id, email ou trecho do nome. Retorna campos operacionais (nome, email, phone, shopify_status, cartpanda_status).',
  paramsSchema,
  handler: async (params, { supabase }) => {
    let query = supabase
      .from('agency_clients')
      .select(
        'id, workspace_id, name, email, phone, shopify_domain, shopify_status, cartpanda_store_slug, cartpanda_status, assigned_products, primary_color, created_at',
      )
      .limit(10);

    if (params.client_id) query = query.eq('id', params.client_id);
    else if (params.email) query = query.eq('email', params.email);
    else if (params.name_contains) query = query.ilike('name', `%${params.name_contains}%`);

    const { data, error } = await query;
    if (error) throw new Error(`agency_clients query falhou: ${error.message}`);

    return { count: data?.length ?? 0, clients: data ?? [] };
  },
};
