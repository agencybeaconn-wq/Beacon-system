// Tipos compartilhados entre actions do Paperclip.
import { z } from 'https://esm.sh/zod@3.25.76';

// @ts-ignore - SupabaseClient genérico para evitar dependência de tipos gerados
export type SupabaseSR = ReturnType<typeof import(
  'https://esm.sh/@supabase/supabase-js@2'
).createClient>;

export interface ActionContext {
  supabase: SupabaseSR;
  actor: string | null;
}

export interface ActionResult {
  [key: string]: unknown;
}

export interface ActionDefinition<TParams> {
  name: string;
  description: string;
  paramsSchema: z.ZodType<TParams>;
  handler: (params: TParams, ctx: ActionContext) => Promise<ActionResult>;
}
