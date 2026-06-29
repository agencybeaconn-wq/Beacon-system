import { supabase } from '@/integrations/supabase/client';

type ShopifyMethod = 'list' | 'list_all' | 'get' | 'create' | 'update' | 'delete' | 'list_assets' | 'get_asset' | 'put_asset' | 'delete_asset';

interface ProxyRequest {
    clientId: string;
    resource: string;
    method?: ShopifyMethod;
    resourceId?: string | number;
    payload?: any;
    params?: Record<string, string | number>;
}

async function shopifyProxy(req: ProxyRequest) {
    // Use fetch directly with anon key to avoid JWT issues
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || anonKey;

    const response = await fetch(`${supabaseUrl}/functions/v1/shopify-admin-proxy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
        },
        body: JSON.stringify(req),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Edge Function error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
    return data;
}

// ─── Collections ─────────────────────────────────────────────────────────

export async function listCollections(clientId: string) {
    const [custom, smart] = await Promise.all([
        shopifyProxy({ clientId, resource: 'custom_collections', method: 'list_all' }),
        shopifyProxy({ clientId, resource: 'smart_collections', method: 'list_all' }),
    ]);
    return [
        ...(custom.data || []).map((c: any) => ({ ...c, _type: 'custom' })),
        ...(smart.data || []).map((c: any) => ({ ...c, _type: 'smart' })),
    ];
}

export async function createCollection(clientId: string, collection: any) {
    return shopifyProxy({
        clientId,
        resource: 'custom_collections',
        method: 'create',
        payload: { custom_collection: collection },
    });
}

export async function updateCollection(clientId: string, id: number, collection: any) {
    return shopifyProxy({
        clientId,
        resource: 'custom_collections',
        method: 'update',
        resourceId: id,
        payload: { custom_collection: { ...collection, id } },
    });
}

export async function deleteCollection(clientId: string, id: number) {
    return shopifyProxy({ clientId, resource: 'custom_collections', method: 'delete', resourceId: id });
}

// ─── Pages ───────────────────────────────────────────────────────────────

export async function listPages(clientId: string) {
    const result = await shopifyProxy({
        clientId,
        resource: 'graphql',
        method: 'graphql' as any,
        payload: {
            query: `{
                pages(first: 100) {
                    edges {
                        node {
                            id
                            title
                            handle
                            body
                            bodySummary
                            createdAt
                            updatedAt
                            isPublished
                        }
                    }
                }
            }`
        }
    });
    return (result.data?.pages?.edges || []).map((e: any) => ({
        ...e.node,
        // Extract numeric ID from GID for REST compatibility
        numericId: e.node.id?.split('/')?.pop(),
        published_at: e.node.isPublished ? e.node.createdAt : null,
        body_html: e.node.body,
    }));
}

export async function createPage(clientId: string, page: { title: string; body_html: string }) {
    return shopifyProxy({
        clientId,
        resource: 'graphql',
        method: 'graphql' as any,
        payload: {
            query: `mutation pageCreate($page: PageCreateInput!) {
                pageCreate(page: $page) {
                    page { id title handle }
                    userErrors { field message }
                }
            }`,
            variables: { page: { title: page.title, body: page.body_html } }
        }
    });
}

export async function updatePage(clientId: string, gid: string, page: { title?: string; body_html?: string }) {
    return shopifyProxy({
        clientId,
        resource: 'graphql',
        method: 'graphql' as any,
        payload: {
            query: `mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
                pageUpdate(id: $id, page: $page) {
                    page { id title handle }
                    userErrors { field message }
                }
            }`,
            variables: { id: gid, page: { title: page.title, body: page.body_html } }
        }
    });
}

export async function deletePage(clientId: string, gid: string) {
    return shopifyProxy({
        clientId,
        resource: 'graphql',
        method: 'graphql' as any,
        payload: {
            query: `mutation pageDelete($id: ID!) {
                pageDelete(id: $id) {
                    deletedPageId
                    userErrors { field message }
                }
            }`,
            variables: { id: gid }
        }
    });
}

// ─── Menus (Navigation) — via GraphQL Admin API ─────────────────────────

export async function listMenus(clientId: string) {
    const result = await shopifyProxy({
        clientId,
        resource: 'graphql',
        method: 'graphql' as any,
        payload: {
            query: `{
                menus(first: 50) {
                    edges {
                        node {
                            id
                            title
                            handle
                            items {
                                id
                                title
                                type
                                url
                                items {
                                    id
                                    title
                                    type
                                    url
                                }
                            }
                        }
                    }
                }
            }`
        }
    });
    return (result.data?.menus?.edges || []).map((e: any) => ({
        ...e.node,
        items: (e.node.items || []).map((item: any) => ({
            ...item,
            children: item.items || []
        }))
    }));
}

export async function createMenuItem(clientId: string, menuId: string, item: { title: string; url?: string; resourceId?: string }) {
    return shopifyProxy({
        clientId,
        resource: 'graphql',
        method: 'graphql' as any,
        payload: {
            query: `mutation menuItemCreate($navigationItemInput: MenuItemCreateInput!) {
                menuItemCreate(navigationItemInput: $navigationItemInput) {
                    menuItem { id title url }
                    userErrors { field message }
                }
            }`,
            variables: {
                navigationItemInput: {
                    menuId,
                    title: item.title,
                    url: item.url,
                    resourceId: item.resourceId,
                }
            }
        }
    });
}

export async function deleteMenuItem(clientId: string, id: string) {
    return shopifyProxy({
        clientId,
        resource: 'graphql',
        method: 'graphql' as any,
        payload: {
            query: `mutation menuItemDelete($id: ID!) {
                menuItemDelete(id: $id) {
                    deletedMenuItemId
                    userErrors { field message }
                }
            }`,
            variables: { id }
        }
    });
}

// ─── Themes ──────────────────────────────────────────────────────────────

export async function listThemes(clientId: string) {
    const result = await shopifyProxy({ clientId, resource: 'themes', method: 'list' });
    return result.data?.themes || [];
}

export async function listThemeAssets(clientId: string, themeId: number) {
    const result = await shopifyProxy({ clientId, resource: 'themes', method: 'list_assets', resourceId: themeId });
    return result.data?.assets || [];
}

export async function getThemeAsset(clientId: string, themeId: number, key: string) {
    const result = await shopifyProxy({ clientId, resource: 'themes', method: 'get_asset', resourceId: themeId, params: { key } });
    return result.data?.asset || null;
}

export async function putThemeAsset(clientId: string, themeId: number, asset: { key: string; value?: string; attachment?: string }) {
    return shopifyProxy({ clientId, resource: 'themes', method: 'put_asset', resourceId: themeId, payload: { asset } });
}

export async function deleteThemeAsset(clientId: string, themeId: number, key: string) {
    return shopifyProxy({ clientId, resource: 'themes', method: 'delete_asset', resourceId: themeId, params: { key } });
}

// ─── Redirects ───────────────────────────────────────────────────────────

export async function listRedirects(clientId: string) {
    const result = await shopifyProxy({ clientId, resource: 'redirects', method: 'list_all' });
    return result.data || [];
}

export async function createRedirect(clientId: string, redirect: { path: string; target: string }) {
    return shopifyProxy({ clientId, resource: 'redirects', method: 'create', payload: { redirect } });
}

export async function deleteRedirect(clientId: string, id: number) {
    return shopifyProxy({ clientId, resource: 'redirects', method: 'delete', resourceId: id });
}

// ─── Blogs & Articles ────────────────────────────────────────────────────

export async function listBlogs(clientId: string) {
    const result = await shopifyProxy({ clientId, resource: 'blogs', method: 'list' });
    return result.data?.blogs || [];
}

export async function listArticles(clientId: string, blogId: number) {
    const result = await shopifyProxy({ clientId, resource: `blogs/${blogId}/articles`, method: 'list_all' });
    return result.data || [];
}
