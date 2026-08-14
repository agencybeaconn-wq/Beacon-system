// @ts-ignore
declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { instrument } from '../_shared/logger.ts';
import { publicTrackedOrderSchema, trackingRequestSchema } from '../_shared/app-contracts.ts';

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

Deno.serve(instrument('app-tracking', async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    try {
        let body: unknown;
        try { body = await req.json(); } catch { return json(400, { error: 'JSON inválido' }); }
        const parsed = trackingRequestSchema.safeParse(body);
        if (!parsed.success) return json(400, { error: 'payload inválido' });

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );
        const { data: device, error: deviceError } = await supabase
            .from('app_devices')
            .select('id, client_id')
            .eq('app_id', parsed.data.app_id)
            .eq('installation_id', parsed.data.installation_id)
            .maybeSingle();
        if (deviceError) throw deviceError;
        if (!device) return json(404, { error: 'instalação não encontrada' });

        // A instalação é a credencial desta consulta. customer_shopify_id é
        // apenas dado de CRM observado na WebView e NÃO pode autorizar leitura:
        // o cliente poderia forjar esse valor no endpoint público de registro.
        const query = supabase
            .from('tracked_orders')
            .select('id, order_number, tracking_number, carrier, status, last_event_text, last_event_at, delivered_at')
            .eq('client_id', device.client_id)
            .eq('device_id', device.id)
            .order('created_at', { ascending: false })
            .limit(50);

        const { data, error } = await query;
        if (error) throw error;
        const orders = (data ?? []).flatMap((row: unknown) => {
            const result = publicTrackedOrderSchema.safeParse(row);
            return result.success ? [result.data] : [];
        });
        return json(200, { orders });
    } catch (error: any) {
        console.error('[app-tracking] falhou', error?.message ?? error);
        return json(500, { error: 'erro interno' });
    }
}));
