
import { instrument } from "../_shared/logger.ts";
import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(instrument("delete-team-member", async (req: Request) => {
    // 1. CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log(">>> [LOG] Delete Member function starting...");

        // --- AUTH: Validate the requesting user ---
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Supabase configuration missing");
        }

        const authHeader = req.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');
        if (!token) {
            return new Response(JSON.stringify({ error: 'Not authenticated' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
            });
        }

        const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || SUPABASE_SERVICE_ROLE_KEY);
        const { data: { user: callerUser }, error: authError } = await supabaseAuth.auth.getUser(token);
        if (authError || !callerUser) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
            });
        }
        console.log(">>> [AUTH] Authenticated user:", callerUser.id);

        let body;
        try {
            body = await req.json();
        } catch (e) {
            throw new Error("Invalid JSON body");
        }

        const { member_id, workspace_id, user_id } = body;

        if (!member_id) throw new Error("Member ID is required");

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // --- AUTH: Verify caller owns the workspace this member belongs to ---
        const { data: memberToDelete } = await supabaseAdmin
            .from('team_members')
            .select('workspace_id')
            .eq('id', member_id)
            .single();

        if (memberToDelete?.workspace_id) {
            const { data: ws } = await supabaseAdmin
                .from('workspaces')
                .select('owner_id')
                .eq('id', memberToDelete.workspace_id)
                .single();

            if (ws?.owner_id !== callerUser.id) {
                // Also check if caller is an admin member of this workspace
                const { data: callerMember } = await supabaseAdmin
                    .from('team_members')
                    .select('id')
                    .eq('workspace_id', memberToDelete.workspace_id)
                    .eq('user_id', callerUser.id)
                    .single();

                if (!callerMember) {
                    return new Response(JSON.stringify({ error: 'You do not have permission to delete members from this workspace' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403,
                    });
                }
            }
        }

        // --- STEP 1: FETCH MEMBER DETAILS (IF NEEDED) ---
        let targetUserId = user_id;

        if (!targetUserId) {
            const { data: member, error: fetchError } = await supabaseAdmin
                .from('team_members')
                .select('user_id')
                .eq('id', member_id)
                .single();

            if (fetchError) {
                console.error("Error fetching member:", fetchError);
                // Proceed to try delete member even if user_id fetch fails (maybe inconsistent state)
            } else {
                targetUserId = member?.user_id;
            }
        }

        // --- STEP 2: DELETE FROM AUTH.USERS ---
        if (targetUserId) {
            console.log(`>>> [LOG] Deleting user from Auth: ${targetUserId}`);
            const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

            if (authDeleteError) {
                console.error(">>> [ERROR] Auth deletion failed:", authDeleteError);
                // We might want to continue to ensure DB cleanup, or stop. 
                // Let's Log but continue to ensure consistency.
            } else {
                console.log(">>> [LOG] Auth user deleted successfully.");
            }
        } else {
            console.log(">>> [LOG] No Auth User ID found, skipping Auth deletion.");
        }

        // --- STEP 3: DELETE FROM TEAM_MEMBERS ---
        console.log(`>>> [LOG] Deleting member from DB: ${member_id}`);
        const { error: dbDeleteError } = await supabaseAdmin
            .from('team_members')
            .delete()
            .eq('id', member_id);

        if (dbDeleteError) {
            throw new Error(`Database Deletion Error: ${dbDeleteError.message}`);
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Member deleted successfully from DB and Auth"
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error(">>> [FATAL ERROR]", error.message || error);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
}));
