import { supabase } from '@/integrations/supabase/client';

async function deploymentProxy(body: any) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || anonKey;

    const response = await fetch(`${supabaseUrl}/functions/v1/store-deployment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Deployment error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
    return data;
}

export async function extractTemplate(sourceClientId: string) {
    const result = await deploymentProxy({ action: 'extract', sourceClientId });
    return result.data;
}

export async function transformData(config: {
    extractedData: any;
    targetClientId: string;
    briefingId?: string;
    aiConfig?: { personalizePages: boolean; adaptDescriptions: boolean };
    sourceBrandName?: string;
}) {
    const result = await deploymentProxy({ action: 'transform', ...config });
    return result.data;
}

export async function deployStep(config: {
    deploymentId?: string;
    targetClientId: string;
    step: 'theme' | 'collections' | 'pages' | 'menus' | 'products';
    data: any;
}) {
    const result = await deploymentProxy({ action: 'deploy_step', ...config });
    return result.data;
}

export async function createDeploymentRecord(config: {
    workspaceId: string;
    sourceClientId: string;
    targetClientId: string;
    briefingId?: string;
    steps: Record<string, boolean>;
    aiConfig: Record<string, boolean>;
    sourceBrandName?: string;
    targetBrandName?: string;
}) {
    const { data, error } = await (supabase as any)
        .from('store_deployments')
        .insert({
            workspace_id: config.workspaceId,
            source_client_id: config.sourceClientId,
            target_client_id: config.targetClientId,
            briefing_id: config.briefingId,
            steps: config.steps,
            ai_config: config.aiConfig,
            source_brand_name: config.sourceBrandName,
            target_brand_name: config.targetBrandName,
            status: 'draft',
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateDeploymentStatus(id: string, updates: Record<string, any>) {
    await (supabase as any)
        .from('store_deployments')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
}
