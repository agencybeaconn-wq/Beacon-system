import { supabase } from '@/integrations/supabase/client';

/**
 * Payload canônico de evento enviado ao painel Paperclip.
 * Use `source` no formato "lever.<dominio>.<acao>" (ex.: "lever.agency_clients.insert").
 */
export interface PaperclipEventPayload {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  source: string;
}

/**
 * Despacha um evento para o painel Paperclip.
 *
 * Fire-and-forget: nunca lança exceção, nunca bloqueia o fluxo chamador.
 * O secret vive apenas no servidor — o front só chama a Edge Function `paperclip-dispatcher`.
 */
export async function dispatchToPaperclip(
  payload: PaperclipEventPayload
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('paperclip-dispatcher', {
      body: payload,
    });
    if (error) {
      console.error('[paperclipDispatcher] Edge Function retornou erro:', error);
    }
  } catch (err) {
    console.error('[paperclipDispatcher] falha ao invocar Edge Function:', err);
  }
}
