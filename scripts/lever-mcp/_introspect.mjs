import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.LEVERSYSTEM_SUPABASE_URL, process.env.LEVERSYSTEM_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await supabase.from('dw_orders').select('*').limit(1);
if (error) { console.error(error); process.exit(1); }
console.log('Colunas dw_orders:', Object.keys(data[0] || {}));
console.log('Sample:', JSON.stringify(data[0], null, 2));
