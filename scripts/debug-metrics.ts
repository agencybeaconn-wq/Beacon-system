// Quick diagnostic: check what's actually in client_daily_metrics
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pxhmzpwvxvlwngjbjkrg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4aG16cHd2eHZsd25namJqa3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc5OTkxNDYsImV4cCI6MjA1MzU3NTE0Nn0.lFMBfSJPsHMQ53pxBOJfMpDJvijxR1lFnmAWX1S1VUg';

async function main() {
    const sb = createClient(supabaseUrl, supabaseKey);

    // 1. Get all clients with fee_fixed > 0
    const { data: clients } = await sb.from('agency_clients').select('id, name, fee_fixed, selected_ad_accounts').gt('fee_fixed', 0);
    console.log('\n=== MRR Clients ===');
    for (const c of (clients || [])) {
        console.log(`  ${c.name} (${c.id}) — fee: R$${c.fee_fixed} — ad_accounts: ${JSON.stringify(c.selected_ad_accounts)}`);
    }

    // 2. For each client, check their metrics for Feb 2025
    const clientIds = (clients || []).map(c => c.id);
    const { data: metrics } = await sb.from('client_daily_metrics').select('*').in('client_id', clientIds).gte('date', '2026-01-01').order('client_id').order('date');

    console.log('\n=== Metrics Summary ===');
    const byClient: Record<string, any[]> = {};
    for (const m of (metrics || [])) {
        if (!byClient[m.client_id]) byClient[m.client_id] = [];
        byClient[m.client_id].push(m);
    }

    for (const [cid, rows] of Object.entries(byClient)) {
        const clientName = (clients || []).find(c => c.id === cid)?.name || cid;
        const totalSpend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
        const totalRevenue = rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
        const totalOrders = rows.reduce((s, r) => s + (Number(r.orders) || 0), 0);
        const totalSessions = rows.reduce((s, r) => s + (Number(r.sessions) || 0), 0);
        const totalApproved = rows.reduce((s, r) => s + (Number(r.approved_transactions) || 0), 0);
        const totalTx = rows.reduce((s, r) => s + (Number(r.transaction_count) || 0), 0);
        const cpRevenue = rows.reduce((s, r) => s + (Number(r.cartpanda_revenue) || 0), 0);

        console.log(`\n  📊 ${clientName}:`);
        console.log(`     Rows: ${rows.length} | Date range: ${rows[0]?.date} → ${rows[rows.length - 1]?.date}`);
        console.log(`     Spend: R$${totalSpend.toFixed(2)} | Revenue(Meta): R$${totalRevenue.toFixed(2)} | Revenue(CP): R$${cpRevenue.toFixed(2)}`);
        console.log(`     Orders: ${totalOrders} | Sessions: ${totalSessions}`);
        console.log(`     Approved: ${totalApproved} | Total Tx: ${totalTx}`);
        console.log(`     ROAS: ${totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : '-'}`);

        // Show last 3 rows as sample
        console.log(`     Sample rows (last 3):`);
        for (const r of rows.slice(-3)) {
            console.log(`       ${r.date}: spend=${r.spend} rev=${r.revenue} orders=${r.orders} sessions=${r.sessions} approved=${r.approved_transactions} tx_count=${r.transaction_count}`);
        }
    }

    // 3. Check total number of rows
    const { count } = await sb.from('client_daily_metrics').select('*', { count: 'exact', head: true });
    console.log(`\n=== Total rows in client_daily_metrics: ${count} ===`);
}

main().catch(console.error);
