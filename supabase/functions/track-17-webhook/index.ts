import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(instrument("track-17-webhook", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'content-type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            }
        })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const payload = await req.json()
        console.log('[17TRACK-Webhook] Received payload:', JSON.stringify(payload))

        // 17TRACK Webhook format: data.track can be an array or single object
        const trackData = payload.data?.track || payload.track
        if (!trackData) {
            return new Response(JSON.stringify({ error: 'No tracking data in payload' }), { status: 400 })
        }

        const tracks = Array.isArray(trackData) ? trackData : [trackData]

        for (const track of tracks) {
            const trackingNumber = track.number
            const latestEvent = track.latest_event || {}

            // Mapping 17TRACK status codes (state)
            // 0: Not found, 10: In transit, 20: Picked up, 30: Undelivered, 35: Returning, 40: Delivered, 45: Expired
            let statusText = 'Em Trânsito'
            if (track.state === 0) statusText = 'Pendente'
            if (track.state === 20) statusText = 'Postado'
            if (track.state === 40) statusText = 'Entregue'
            if (track.state === 30) statusText = 'Atrasado'
            if (track.state === 35) statusText = 'Devolvido'
            if (track.state === 45) statusText = 'Expirado'

            const content = (latestEvent.content || '').toLowerCase()

            // Comprehensive tax/attention detection
            const isTaxed = content.includes('fiscal') ||
                content.includes('taxado') ||
                content.includes('aguardando pagamento') ||
                content.includes('despacho postal') ||
                content.includes('importação') ||
                track.sub_state === 3004; // 17TRACK sub_state for tax issues

            const needsAttention = track.state === 30 || track.state === 35 || isTaxed || track.state === 45;

            const { error } = await supabaseClient
                .from('shipments')
                .update({
                    status: statusText,
                    sub_status: track.sub_state_name || '',
                    last_event_description: latestEvent.content || 'Sem detalhes',
                    last_event_time: latestEvent.time || new Date().toISOString(),
                    is_taxed: isTaxed,
                    needs_attention: needsAttention,
                    is_atrasado: track.state === 30,
                    updated_at: new Date().toISOString()
                })
                .eq('tracking_number', trackingNumber)

            if (error) {
                console.error(`[Webhook] Error updating shipment ${trackingNumber}:`, error)
            } else {
                console.log(`[Webhook] Successfully updated shipment ${trackingNumber}`)
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })

    } catch (error: any) {
        console.error('[Webhook] Fatal error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
    }
}))
