// client-credentials — gerencia credenciais (logins/senhas) de clientes com criptografia.
//
// Actions:
//   POST { action: "list", client_id }
//     → retorna [{ id, label, category, username, url, notes, created_at, updated_at }]
//        (SEM password)
//
//   POST { action: "get", id }
//     → retorna { id, label, category, username, password, url, notes, ... }
//        (COM password decriptada — só pra modal de visualização single)
//
//   POST { action: "upsert", id?, client_id, label, category?, username?, password?, url?, notes? }
//     → cria ou atualiza. password é encriptado server-side antes de salvar.
//        Se id presente, faz UPDATE. Se ausente, INSERT.
//
//   POST { action: "delete", id }
//     → deleta. Cascade não aplica (filho de agency_clients).
//
// Auth: JWT do usuário (validado pelo Supabase). RLS filtra acesso.
// Service role usado pra chamar funcções de encrypt/decrypt (SECURITY DEFINER).

import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface CredentialPayload {
    id?: string;
    client_id?: string;
    label?: string;
    category?: string;
    username?: string | null;
    password?: string | null;
    url?: string | null;
    notes?: string | null;
}

async function handleList(supabase: any, userJwt: string, clientId: string) {
    if (!clientId) throw new Error('client_id obrigatório');

    // Cria client com JWT do user pra respeitar RLS
    const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${userJwt}` } } }
    );

    const { data, error } = await userClient
        .from('client_credentials')
        .select('id, client_id, label, category, username, url, notes, created_at, updated_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

async function handleGet(supabase: any, userJwt: string, id: string) {
    if (!id) throw new Error('id obrigatório');

    // 1. Verifica permissão via RLS (com JWT do user)
    const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${userJwt}` } } }
    );

    const { data: row, error: selErr } = await userClient
        .from('client_credentials')
        .select('id, client_id, label, category, username, url, notes, created_at, updated_at, password_encrypted')
        .eq('id', id)
        .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error('Credencial não encontrada ou sem permissão');

    // 2. Decripta com service_role (a função pgcrypto é SECURITY DEFINER)
    let password: string | null = null;
    if (row.password_encrypted) {
        const { data: dec, error: decErr } = await supabase.rpc(
            'decrypt_client_credential',
            { cipher: row.password_encrypted }
        );
        if (decErr) throw new Error('decrypt: ' + decErr.message);
        password = dec;
    }

    const { password_encrypted, ...rest } = row;
    return { ...rest, password };
}

async function handleUpsert(supabase: any, userJwt: string, payload: CredentialPayload, userId: string | null) {
    if (!payload.label) throw new Error('label obrigatório');
    if (!payload.id && !payload.client_id) throw new Error('client_id obrigatório no insert');

    // Encripta password se fornecido
    let passwordEncrypted: string | null | undefined = undefined; // undefined = não tocar
    if (payload.password !== undefined) {
        if (payload.password === null || payload.password === '') {
            passwordEncrypted = null;
        } else {
            const { data: enc, error: encErr } = await supabase.rpc(
                'encrypt_client_credential',
                { plain: payload.password }
            );
            if (encErr) throw new Error('encrypt: ' + encErr.message);
            passwordEncrypted = enc;
        }
    }

    // Usa service_role pra escrita — RLS validamos via SELECT antes
    const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${userJwt}` } } }
    );

    const baseFields: any = {
        label: payload.label,
        category: payload.category || 'other',
        username: payload.username ?? null,
        url: payload.url ?? null,
        notes: payload.notes ?? null,
    };
    if (passwordEncrypted !== undefined) baseFields.password_encrypted = passwordEncrypted;

    if (payload.id) {
        // UPDATE — RLS valida acesso
        const { data, error } = await userClient
            .from('client_credentials')
            .update(baseFields)
            .eq('id', payload.id)
            .select('id, client_id, label, category, username, url, notes, created_at, updated_at')
            .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new Error('Credencial não encontrada ou sem permissão');
        return data;
    } else {
        // INSERT
        const insertRow = {
            ...baseFields,
            client_id: payload.client_id,
            created_by: userId,
        };
        const { data, error } = await userClient
            .from('client_credentials')
            .insert(insertRow)
            .select('id, client_id, label, category, username, url, notes, created_at, updated_at')
            .maybeSingle();
        if (error) throw new Error(error.message);
        return data;
    }
}

async function handleDelete(userJwt: string, id: string) {
    if (!id) throw new Error('id obrigatório');
    const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${userJwt}` } } }
    );
    const { error } = await userClient
        .from('client_credentials')
        .delete()
        .eq('id', id);
    if (error) throw new Error(error.message);
    return { deleted: id };
}

Deno.serve(instrument("client-credentials", async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const authHeader = req.headers.get('Authorization');
        const userJwt = authHeader?.replace('Bearer ', '');
        if (!userJwt) throw new Error('Authorization header ausente');

        // Service role client — pra chamar RPC de encrypt/decrypt
        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Resolve userId do JWT (pra `created_by`)
        let userId: string | null = null;
        try {
            const { data: { user } } = await adminClient.auth.getUser(userJwt);
            userId = user?.id ?? null;
        } catch { /* anon ou inválido — RLS vai bloquear */ }

        const body = await req.json();
        const { action } = body;

        let result;
        switch (action) {
            case 'list':
                result = await handleList(adminClient, userJwt, body.client_id);
                break;
            case 'get':
                result = await handleGet(adminClient, userJwt, body.id);
                break;
            case 'upsert':
                result = await handleUpsert(adminClient, userJwt, body, userId);
                break;
            case 'delete':
                result = await handleDelete(userJwt, body.id);
                break;
            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || String(error) }), {
            status: error.message?.includes('não encontrada') ? 404 : 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}));
