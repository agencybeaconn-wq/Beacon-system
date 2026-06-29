
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export class CircuitBreaker {
    private supabase: any;
    private workspaceId: string;
    private connectionId: string;

    constructor(supabaseClient: any, workspaceId: string, connectionId: string) {
        this.supabase = supabaseClient;
        this.workspaceId = workspaceId;
        this.connectionId = connectionId;
    }

    /**
     * Executes a Meta API call with safety checks.
     * 1. Checks if connection is quarantined.
     * 2. Executes the API call.
     * 3. Intercepts security errors -> Increments Risk.
     */
    async execute<T>(apiCall: () => Promise<T>): Promise<T> {
        // 1. Pre-flight Check
        const { data: connection, error: connError } = await this.supabase
            .from('fb_connections')
            .select('status, risk_score')
            .eq('id', this.connectionId)
            .single();

        if (connError) {
            console.error(`[CircuitBreaker] Failed to fetch connection ${this.connectionId}:`, connError);
            // Fail safe: If we can't verify status, we block to be safe? Or allow? 
            // Better to block if it's a critical security feature.
            throw new Error("Security Check Failed: Could not verify connection status.");
        }

        if (connection.status === 'quarantined') {
            await this.logAudit('QUARANTINE_BLOCK', { message: 'Action blocked due to quarantine status' }, 'warning');
            throw new Error("Connection Quarantined: This profile is restricted from performing actions.");
        }

        // 2. Execute Action
        try {
            return await apiCall();
        } catch (error: any) {
            // 3. Error Interception
            await this.handleError(error);
            throw error; // Re-throw after handling
        }
    }

    private async handleError(error: any) {
        const errorCode = error?.error?.code || error?.code;
        const subCode = error?.error?.error_subcode || error?.error_subcode;

        // Critical Security Error Codes from Meta
        // 10: Permission Denied
        // 100: Invalid Parameter (sometimes benign, but often policy)
        // 190: Access Token Invalid (User changed password, etc.)
        // 368: Policy Block (Temporarily blocked)
        const RISKY_CODES = [10, 190, 368];

        // Check if it's a risky error
        if (RISKY_CODES.includes(errorCode)) {
            console.warn(`[CircuitBreaker] Detected RISKY error code: ${errorCode}`);

            await this.incrementRiskScore(errorCode, error);
        }

        // Log all errors to audit
        await this.logAudit('API_ERROR', { error }, 'info');
    }

    private async incrementRiskScore(errorCode: number, fullError: any) {
        // Increment Risk Score via RPC or direct update
        // We'll read, increment, and update for simplicity (or use a SQL function if concurrency is high)
        // For now, read-modify-write is okay for low volume.

        const { data: current } = await this.supabase
            .from('fb_connections')
            .select('risk_score')
            .eq('id', this.connectionId)
            .single();

        const newScore = (current?.risk_score || 0) + 1;

        let newStatus = 'active';
        if (newScore >= 3) {
            newStatus = 'quarantined';
        } else if (errorCode === 190) { // Token invalid
            newStatus = 'reauth_required';
        }

        const { error } = await this.supabase
            .from('fb_connections')
            .update({
                risk_score: newScore,
                status: newStatus
            })
            .eq('id', this.connectionId);

        if (!error) {
            await this.logAudit(
                newStatus === 'quarantined' ? 'QUARANTINE_TRIGGERED' : 'RISK_SCORE_INCREMENTED',
                { errorCode, newScore, newStatus, fullError },
                newStatus === 'quarantined' ? 'critical' : 'warning'
            );
        }
    }

    private async logAudit(actionType: string, payload: any, severity: 'info' | 'warning' | 'critical' = 'info') {
        await this.supabase.from('system_audit_logs').insert({
            workspace_id: this.workspaceId,
            connection_id: this.connectionId,
            action_type: actionType,
            api_response: payload,
            severity,
            timestamp: new Date().toISOString()
        });
    }
}
