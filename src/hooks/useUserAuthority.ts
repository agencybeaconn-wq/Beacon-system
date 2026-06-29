import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AuthorityTier } from "@/lib/authorityUtils";

export interface UserAuthority {
  user_id: string;
  lifetime_spend: number;
  highest_roas: number;
  current_streak: number;
  last_activity_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAuthorityWithTier extends UserAuthority {
  tier: AuthorityTier;
  progressToNext: number;
  nextTier: AuthorityTier | null;
}

// Mock data for development/testing
const MOCK_AUTHORITY: UserAuthority = {
  user_id: "mock-user-id",
  lifetime_spend: 450000,
  highest_roas: 12.4,
  current_streak: 7,
  last_activity_date: new Date().toISOString().split("T")[0],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function useUserAuthority(useMockData = false): {
  authority: UserAuthorityWithTier | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [authority, setAuthority] = useState<UserAuthorityWithTier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAuthority = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (useMockData) {
        // Use mock data for development
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API delay
        
        const { calculateTier, calculateProgressToNextTier, getNextTier } = await import("@/lib/authorityUtils");
        const tier = calculateTier(MOCK_AUTHORITY.lifetime_spend);
        const progressToNext = calculateProgressToNextTier(MOCK_AUTHORITY.lifetime_spend, tier);
        const nextTier = getNextTier(tier);

        setAuthority({
          ...MOCK_AUTHORITY,
          tier,
          progressToNext,
          nextTier,
        });
        setIsLoading(false);
        return;
      }

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("User not authenticated");
      }

      // Fetch user authority
      const { data, error: fetchError } = await supabase
        .from("user_authority")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (fetchError) {
        // If no record exists, create one
        if (fetchError.code === "PGRST116") {
          const { data: newData, error: insertError } = await supabase
            .from("user_authority")
            .insert({ user_id: user.id })
            .select()
            .single();

          if (insertError) {
            throw insertError;
          }

          const { calculateTier, calculateProgressToNextTier, getNextTier } = await import("@/lib/authorityUtils");
          const tier = calculateTier(newData.lifetime_spend || 0);
          const progressToNext = calculateProgressToNextTier(newData.lifetime_spend || 0, tier);
          const nextTier = getNextTier(tier);

          setAuthority({
            ...newData,
            tier,
            progressToNext,
            nextTier,
          });
          setIsLoading(false);
          return;
        }
        throw fetchError;
      }

      // Calculate tier and progress
      const { calculateTier, calculateProgressToNextTier, getNextTier } = await import("@/lib/authorityUtils");
      const tier = calculateTier(data.lifetime_spend || 0);
      const progressToNext = calculateProgressToNextTier(data.lifetime_spend || 0, tier);
      const nextTier = getNextTier(tier);

      setAuthority({
        ...data,
        tier,
        progressToNext,
        nextTier,
      });
    } catch (err) {
      console.error("Error fetching user authority:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthority();
  }, [useMockData]);

  return {
    authority,
    isLoading,
    error,
    refetch: fetchAuthority,
  };
}

