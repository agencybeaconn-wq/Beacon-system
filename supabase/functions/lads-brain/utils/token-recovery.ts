// Token Recovery Functions for Lads Brain
// @ts-nocheck
/**
 * Token Recovery with Fallback Strategy
 * Tries multiple sources to find the Facebook access_token
 */ export async function getAccessToken(supabase, accountId, authHeader) {
  console.log("🔍 [GET_TOKEN] Iniciando busca de token...");
  // 1. Clean 'ACT_' prefix from accountId
  let cleanAccountIdWithoutPrefix = accountId;
  if (accountId) {
    cleanAccountIdWithoutPrefix = accountId.replace(/^act_/i, '');
  }
  // 2. Get user_id from Supabase Auth
  let userId = null;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError) {
        console.error("❌ [GET_TOKEN] Erro ao obter user do auth:", userError);
      } else if (user) {
        userId = user.id;
      }
    } catch (error) {
      console.error("❌ [GET_TOKEN] Erro ao chamar auth.getUser():", error);
    }
  }
  // Try 1 (TOP PRIORITY): Get token from user connections/meta_tokens
  if (userId) {
    try {
      const { data: connection } = await supabase.from('connections').select('access_token, provider, user_id').eq('user_id', userId).eq('provider', 'facebook').limit(1).single();
      if (connection?.access_token) {
        return connection.access_token;
      }
    } catch (error) {
    // ignore
    }
    const { data: userMetaToken } = await supabase.from('meta_tokens').select('access_token').eq('user_id', userId).order('updated_at', {
      ascending: false
    }).limit(1).single();
    if (userMetaToken?.access_token) {
      return userMetaToken.access_token;
    }
  }
  // Try 2 (LAST RESORT): Get by Account ID
  if (accountId) {
    const { data: account } = await supabase.from('ad_accounts').select('access_token').eq('id', accountId).single();
    if (account?.access_token) {
      return account.access_token;
    }
  }
  return null;
}
