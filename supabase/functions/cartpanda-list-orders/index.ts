import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("[Edge Function] Script loaded and initializing...");

interface CartPandaOrdersRequest {
    clientId: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    paymentStatus?: number; // 1 = PENDING, 3 = PAID, 4 = CANCELLED
}

interface CartPandaOrder {
    id: number;
    name: string;
    total_price: string;
    unformatted_total_price: number;
    payment_status: number;
    payment_gateway: string;
    payment_type: string;
    created_at: string;
    processed_at: string;
    customer: {
        first_name: string;
        last_name: string;
        email: string;
    };
    line_items: Array<{
        title: string;
        quantity: number;
        price: number;
    }>;
}

interface FormattedOrder {
    id: number;
    orderNumber: string;
    totalPrice: number;
    totalPriceFormatted: string;
    paymentStatus: 'pending' | 'paid' | 'cancelled';
    paymentGateway: string;
    paymentType: string;
    createdAt: string;
    customerName: string;
    customerEmail: string;
    itemCount: number;
    items: Array<{
        title: string;
        quantity: number;
        price: number;
    }>;
}

// @ts-ignore
Deno.serve(instrument("cartpanda-list-orders", async (req: Request) => {
    console.log(`[Edge Function] Request received: ${req.method} ${req.url}`);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json();
        console.log('[Edge Function] Raw body received:', JSON.stringify(body));

        const {
            clientId,
            startDate,
            endDate,
            page = 1,
            limit = 50,
            paymentStatus = 3, // Default: PAID orders only
        }: CartPandaOrdersRequest = body;

        if (!clientId) {
            console.error('[Edge Function] Missing clientId');
            return new Response(
                JSON.stringify({ error: "clientId é obrigatório" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get CartPanda credentials from agency_clients
        // @ts-ignore
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        // @ts-ignore
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log('[Edge Function] Fetching client data for ID:', clientId);

        const { data: clientData, error: clientError } = await supabase
            .from("agency_clients")
            .select("cartpanda_store_slug, cartpanda_bearer_token, cartpanda_status")
            .eq("id", clientId)
            .single();

        if (clientError || !clientData) {
            console.error('[Edge Function] Client not found or error:', clientError);
            return new Response(
                JSON.stringify({ error: "Cliente não encontrado" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (clientData.cartpanda_status !== "connected") {
            console.error('[Edge Function] CartPanda not connected for client');
            return new Response(
                JSON.stringify({ error: "CartPanda não está conectado para este cliente" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { cartpanda_store_slug, cartpanda_bearer_token } = clientData;

        // Fetch orders from CartPanda — paginacao adaptativa.
        // Nao confia em last_page do payload (API CartPanda pode vir flat sem metadata Laravel-style).
        // Estrategia: batches paralelos de 5 paginas; para quando uma pagina vier com menos itens que perPageLimit (= ultima).
        let allOrders: any[] = [];
        const perPageLimit = 250;
        const BATCH_SIZE = 5;        // 5 paginas em paralelo por batch
        const MAX_PAGES = 200;       // cap de seguranca: 50k orders

        console.log(`[Edge Function] Starting adaptive paginated fetch for client ${cartpanda_store_slug}`);

        try {
            const buildUrl = (p: number) => {
                let url = `https://accounts.cartpanda.com/api/${cartpanda_store_slug}/orders?page=${p}&limit=${perPageLimit}&per_page=${perPageLimit}&payment_status=${paymentStatus}`;
                if (startDate) url += `&created_at_min=${encodeURIComponent(startDate)}`;
                if (endDate) url += `&created_at_max=${encodeURIComponent(endDate)}`;
                return url;
            };

            const fetchPage = async (p: number) => {
                const res = await fetch(buildUrl(p), {
                    method: "GET",
                    headers: {
                        "Accept": "application/json",
                        "Authorization": `Bearer ${cartpanda_bearer_token}`,
                    },
                });
                if (!res.ok) {
                    console.warn(`[Edge Function] Page ${p} returned status ${res.status}`);
                    return null;
                }
                return await responseToJson(res);
            };

            // Pagina 1 — sempre busca, e loga estrutura pra debug futuro
            const firstPageData = await fetchPage(1);
            if (!firstPageData) {
                throw new Error("CartPanda API error on first page");
            }

            console.log(`[Edge Function] First page payload keys: ${Object.keys(firstPageData).join(',')} | orders is ${Array.isArray(firstPageData.orders) ? 'array' : typeof firstPageData.orders}`);

            const firstPageOrders = extractOrders(firstPageData);
            allOrders = [...firstPageOrders];

            // Se primeira pagina ja veio parcial, terminou
            let keepFetching = firstPageOrders.length >= perPageLimit;
            let currentPage = 2;

            while (keepFetching && currentPage <= MAX_PAGES) {
                const batchEnd = Math.min(currentPage + BATCH_SIZE - 1, MAX_PAGES);
                const pagePromises = [];
                for (let p = currentPage; p <= batchEnd; p++) {
                    pagePromises.push(fetchPage(p));
                }

                const batchResults = await Promise.all(pagePromises);
                for (const pageData of batchResults) {
                    if (!pageData) {
                        keepFetching = false;
                        continue;
                    }
                    const pageOrders = extractOrders(pageData);
                    allOrders = [...allOrders, ...pageOrders];
                    // Pagina parcial = ultima pagina
                    if (pageOrders.length < perPageLimit) {
                        keepFetching = false;
                    }
                }
                currentPage = batchEnd + 1;
            }

            console.log(`[Edge Function] Paginated fetch done. Pages traversed: ${currentPage - 1}. Total raw orders: ${allOrders.length}`);
        } catch (fetchErr) {
            console.error(`[Edge Function] fetch logic error:`, fetchErr);
        }

        // Helper functions for the refactored logic
        async function responseToJson(res: Response) {
            try {
                return await res.json();
            } catch (e) {
                return {};
            }
        }

        function extractOrders(data: any) {
            if (data.orders && Array.isArray(data.orders.data)) {
                return data.orders.data;
            } else if (Array.isArray(data.orders)) {
                return data.orders;
            } else if (data.data && Array.isArray(data.data)) {
                return data.data;
            }
            return [];
        }

        console.log(`[Edge Function] Fetch complete. Total raw orders: ${allOrders.length}`);

        // Format orders with enhanced type safety for filtering
        const formattedOrders: FormattedOrder[] = allOrders
            .filter(order => {
                const orderStatus = order.payment_status?.toString();
                const targetStatus = paymentStatus?.toString();
                return orderStatus === targetStatus;
            })
            .map(order => {
                let status: 'pending' | 'paid' | 'cancelled' = 'pending';
                const s = Number(order.payment_status);
                if (s === 3) status = 'paid';
                else if (s === 4) status = 'cancelled';

                const totalPriceInCents = order.unformatted_total_price || 0;
                const totalPrice = totalPriceInCents / 100;

                return {
                    id: order.id,
                    orderNumber: order.name,
                    totalPrice,
                    totalPriceFormatted: `R$ ${totalPrice.toFixed(2).replace('.', ',')}`,
                    paymentStatus: status,
                    paymentGateway: order.payment_gateway || 'unknown',
                    paymentType: order.payment_type || 'unknown',
                    createdAt: order.created_at,
                    customerName: order.customer
                        ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
                        : 'N/A',
                    customerEmail: order.customer?.email || 'N/A',
                    itemCount: order.line_items?.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) || 0,
                    items: order.line_items || [],
                };
            });

        const totalRevenue = formattedOrders.reduce((acc, order) => acc + order.totalPrice, 0);
        const totalOrders = formattedOrders.length;

        console.log(`[Edge Function] Returning ${totalOrders} orders. Total: R$ ${totalRevenue}`);

        return new Response(
            JSON.stringify({
                success: true,
                orders: formattedOrders,
                summary: {
                    totalOrders,
                    totalRevenue,
                    totalRevenueFormatted: `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`,
                    averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
                },
                pagination: {
                    page,
                    limit,
                    hasMore: allOrders.length === limit,
                }
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("[Edge Function] Global Catch Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
}));
