import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// @ts-ignore
Deno.serve(instrument("list-ad-accounts", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { accessToken } = await req.json()

        if (!accessToken) {
            throw new Error('Missing access token')
        }

        // Fetch Ad Accounts from Meta
        const url = `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,currency,account_status,amount_spent,business&access_token=${accessToken}&limit=100`

        const resp = await fetch(url)
        const data = await resp.json()

        if (data.error) {
            throw new Error(data.error.message)
        }

        const accounts = data.data.map((acc: any) => ({
            id: acc.id.replace('act_', ''), // Remove 'act_' prefix for cleaner IDs usually, but need to check convention.
            // Meta IDs are usually 'act_123456'. Let's keep the raw ID or just numbers?
            // Convention: usually we store the ID as is or just numbers.
            // If we use 'act_', we should be consistent.
            // Let's strip 'act_' as it's cleaner for display, but for API calls we need to add it back if missing.
            // However, for simplicity, let's KEEP 'act_' if that's what API returns, or just numbers? 
            // The ad_accounts table uses text ID.
            // Let's keep it consistent with what Meta returns for now, but usually people strip it.
            // Actually, standard is usually just the number for "account_id".
            // Let's strip "act_" to store purely the numeric ID in "account_id".
            // But "id" in "ad_accounts" table is the primary key.
            // If I use the same ID as primary key, it must be unique.
            account_id: acc.id.replace('act_', ''),
            name: acc.name,
            currency: acc.currency,
            status: acc.account_status === 1 ? 'ACTIVE' : 'INACTIVE', // 1 = Active
            business_name: acc.business?.name
        }))

        return new Response(
            JSON.stringify({ accounts }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
}));
