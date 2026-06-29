# Deploy de edge functions preservando o verify_jwt atual de cada uma.
# Uso: powershell -File scripts/deploy-fns.ps1 fn1 fn2 ...
# Funcoes no conjunto $NoJwt sao deployadas com --no-verify-jwt (estado atual = false).
# As demais com verify_jwt=true (default do CLI). NUNCA muda o verify_jwt vigente.

$NoJwt = @(
  'shopify-auth-start','shopify-oauth-callback','list-ad-accounts','fb-oauth-callback',
  'invite-team-member','cartpanda-list-orders','delete-team-member','send-whatsapp',
  'receive-external-lead','import-existing-leads','diagnose-whatsapp','setup-lead-trigger',
  'google-oauth-callback','google-drive','google-calendar','gemini-ai','shopify-bulk-update',
  'shopify-fetch-products','shopify-webhooks','notify-task-assigned','list-ad-comments',
  'shopify-admin-proxy','gemini-image-gen','shopify-webhook-receiver','send-academy-invite',
  'paperclip-dispatcher','paperclip-inbound','send-meeting-reminders','clarity-proxy',
  'reviews-api','dw-daily-sync','notify-task-completed','manage-meta-campaign',
  'get-campaign-history','scan-for-anomalies','manage-client-goal','get-ad-identities',
  'get-catalog-products','get-video-source','get-shared-dashboard','list-leadgen-forms',
  'create-quick-campaign','client-upload','drive-oauth-callback','mcp-shopify-proxy',
  'mcp-meta-proxy'
)

# Lista do restante a deployar (em prod, instrumentadas, fonte = supabase/functions).
# Exclui: 10 criticas ja deployadas, generate-report-insights/send-report-email
# (fonte em scripts/_phase2-edgefn), melhor-envio-* (nao deployadas), e as minhas.
$REMAINING = @(
  'cartpanda-list-orders','clarity-proxy','claude-ai','client-credentials','client-upload',
  'crm-generate-greeting','delete-team-member','diagnose-whatsapp','drive-oauth-callback',
  'dw-daily-sync','fetch-ad-comments','fetch-meta-data','gemini-ai','gemini-image-gen',
  'generate-insights','get-ad-identities','get-ad-insights','get-ad-preview','get-campaign-history',
  'get-catalog-products','get-fb-token','get-meta-hierarchy','get-product-catalogs',
  'get-shared-dashboard','get-video-source','google-calendar','google-drive','google-oauth-callback',
  'import-existing-leads','invite-team-member','lads-brain','list-ad-accounts','list-leadgen-forms',
  'list-pixels','list-whatsapp-groups','manage-ad-rules','manage-client-goal','manage-custom-audiences',
  'manage-meta-assets','mcp-meta-proxy','mcp-shopify-proxy','notify-task-assigned','notify-task-completed',
  'paperclip-dispatcher','paperclip-inbound','reply-to-comment','report-metrics','scan-ad-comments',
  'scan-for-anomalies','search-meta-geo','search-meta-interests','send-academy-invite','setup-lead-trigger',
  'shopify-auth-start','shopify-bulk-update','shopify-fetch-products','shopify-oauth-callback',
  'shopify-webhooks','store-deployment','sync-meta-campaigns','sync-shopify-orders','track-17-api',
  'track-17-webhook','update-ad-creative','update-shared-dashboard-costs','whatsapp-evolution'
)

$CRITICAL = @(
  'create-meta-campaign','create-quick-campaign','manage-meta-campaign','send-whatsapp',
  'shopify-webhook-receiver','shopify-admin-proxy','cartpanda-validate','receive-external-lead',
  'send-meeting-reminders','fb-oauth-callback'
)

$targets = $args
if ($args.Count -eq 1 -and $args[0] -eq 'REMAINING') { $targets = $REMAINING }
if ($args.Count -eq 1 -and $args[0] -eq 'ALL') { $targets = $CRITICAL + $REMAINING }

$results = @()
foreach ($fn in $targets) {
  if ($NoJwt -contains $fn) { $jwt = 'false' } else { $jwt = 'true' }
  Write-Output "=== deploy $fn (verify_jwt=$jwt) ==="
  if ($jwt -eq 'false') {
    $out = npx --no-install supabase functions deploy $fn --no-verify-jwt 2>&1 | Out-String
  } else {
    $out = npx --no-install supabase functions deploy $fn 2>&1 | Out-String
  }
  if ($out -match 'Deployed Functions on project') { $st = 'OK' } else { $st = 'FALHOU' }
  $results += [pscustomobject]@{ fn = $fn; st = $st }
  if ($st -eq 'FALHOU') { Write-Output $out }
}
Write-Output "=== RESUMO ==="
foreach ($r in $results) { Write-Output ($r.fn + ": " + $r.st) }