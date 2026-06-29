# Shopify OAuth Setup for Client-Specific Connections

This document describes how to configure Shopify OAuth to work with the client-specific integration in the Lever System.

## Database Migration

Run the migration in `migrations/20260120_add_shopify_to_agency_clients.sql` to add the following fields to `agency_clients`:

- `shopify_domain` - The Shopify store domain (e.g., store.myshopify.com)
- `shopify_access_token` - OAuth access token for Shopify API
- `shopify_status` - Connection status: disconnected, pending, connected, error
- `shopify_connected_at` - Timestamp when connected
- `shopify_shop_name` - Friendly name of the shop

## Edge Function: shopify-auth-start

The existing `shopify-auth-start` function needs to be updated to accept a `clientId` parameter.

### Expected Query Parameters:
- `shop` - The Shopify domain (e.g., store.myshopify.com)
- `clientId` - The agency_clients.id to associate the connection with
- `returnUrl` - URL to redirect back to after OAuth completes

### Flow:
1. Receive request with shop, clientId, returnUrl
2. Generate state token containing clientId
3. Redirect to Shopify OAuth authorization URL
4. Include scopes: read_products, read_orders, read_customers (adjust as needed)

## Edge Function: shopify-oauth-callback

The callback function needs to:

1. Extract clientId from state parameter
2. Exchange authorization code for access token
3. Fetch shop info from Shopify API
4. Update agency_clients record:
   ```sql
   UPDATE agency_clients
   SET
     shopify_access_token = '<token>',
     shopify_status = 'connected',
     shopify_shop_name = '<shop_name>',
     shopify_connected_at = NOW()
   WHERE id = '<clientId>'
   ```
5. Redirect back to returnUrl with `?shopify=success&shop=<domain>`

### Error Handling:
On error, redirect to returnUrl with `?shopify=error&message=<error_message>`

## Environment Variables Required

In Supabase Dashboard > Project Settings > Edge Functions:

- `SHOPIFY_API_KEY` - Your Shopify App API Key
- `SHOPIFY_API_SECRET` - Your Shopify App API Secret
- `SHOPIFY_SCOPES` - Required scopes (e.g., "read_products,read_orders")

## Shopify App Configuration

1. Create a Shopify App in Partner Dashboard
2. Set App URL to your Supabase project URL
3. Set Allowed redirection URL(s):
   - `https://<project>.supabase.co/functions/v1/shopify-oauth-callback`
4. Enable the required access scopes

## Testing

1. Run the SQL migration
2. Deploy edge functions
3. Go to a client's profile > Conexoes tab
4. Enter a Shopify domain and click connect
5. Complete OAuth on Shopify
6. Verify connection shows as "Conectado"
