import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlanUsage {
    currentSpend: number;
    limit: number;
    percentage: number;
    planName: 'Starter' | 'Growth' | 'Scale' | 'Whale';
    isOverLimit: boolean;
}

const PLAN_LIMITS = {
    Starter: 5000,
    Growth: 30000,
    Scale: 100000,
    Whale: 500000
};

export const usePlanUsage = () => {
    return useQuery({
        queryKey: ['plan-usage'],
        queryFn: async (): Promise<PlanUsage> => {
            // 1. Fetch total spend from insights (Last 30 days)
            // For now, we'll mock this or try to fetch real data if available.
            // In a real scenario, we would sum up 'spend' from 'insights' table for all connected accounts.

            // Mocking a realistic scenario for "Growth" plan (Limit 30k)
            const mockSpend = 24500.50;
            const mockPlan: 'Growth' = 'Growth';

            const limit = PLAN_LIMITS[mockPlan];
            const percentage = (mockSpend / limit) * 100;

            return {
                currentSpend: mockSpend,
                limit: limit,
                percentage: Math.min(percentage, 100), // Cap at 100 for UI, but isOverLimit handles logic
                planName: mockPlan,
                isOverLimit: mockSpend > limit
            };
        }
    });
};
