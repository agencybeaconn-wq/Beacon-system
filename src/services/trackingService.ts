import { supabase } from "@/integrations/supabase/client";

export interface ShipmentStats {
    total: number;
    taxed: number;
    attention: number;
    delivered: number;
    transit: number;
}

export const trackingService = {
    async registerTracking(number: string) {
        console.log('[TrackingService] Registering number:', number);
        const { data, error } = await supabase.functions.invoke('track-17-api', {
            body: { number }
        });

        if (error) {
            console.error('[TrackingService] Supabase context error:', error);
            throw error;
        }

        if (data?.error) {
            console.error('[TrackingService] API level error:', data.error);
            throw new Error(data.error);
        }

        return data;
    },

    async getDashboardStats(): Promise<ShipmentStats> {
        const { data, error } = await (supabase.from as any)('shipments')
            .select('status, is_taxed, needs_attention');

        if (error) {
            console.error('[TrackingService] Error fetching stats:', error);
            throw error;
        }

        const stats: ShipmentStats = {
            total: data?.length || 0,
            taxed: data?.filter((s: any) => s.is_taxed).length || 0,
            attention: data?.filter((s: any) => s.needs_attention).length || 0,
            delivered: data?.filter((s: any) => s.status === 'Entregue').length || 0,
            transit: data?.filter((s: any) => s.status !== 'Entregue' && s.status !== 'Devolvido' && s.status !== 'Pendente').length || 0
        };

        return stats;
    },

    async getStatusCounts() {
        const { data, error } = await (supabase.from as any)('shipments')
            .select('status');

        if (error) {
            console.error('[TrackingService] Error fetching status counts:', error);
            throw error;
        }

        const counts: Record<string, number> = {};
        data?.forEach((s: any) => {
            if (s.status) {
                counts[s.status] = (counts[s.status] || 0) + 1;
            }
        });

        return counts;
    },

    async getShipments() {
        const { data, error } = await (supabase.from as any)('shipments')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('[TrackingService] Error fetching shipments:', error);
            throw error;
        }

        return data;
    },

    async syncTracking(number: string) {
        console.log('[TrackingService] Syncing number:', number);
        const { data, error } = await supabase.functions.invoke('track-17-api', {
            body: { number, action: 'sync' }
        });

        if (error) {
            console.error('[TrackingService] Sync error:', error);
            throw error;
        }

        return data;
    }
};
