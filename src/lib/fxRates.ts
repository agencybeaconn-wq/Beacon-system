/**
 * Cotações de câmbio (FX rates) → BRL
 *
 * Camadas:
 * 1. Cache em memória (sessão atual)
 * 2. Tabela fx_rates do Supabase (histórico persistido)
 * 3. AwesomeAPI (https://economia.awesomeapi.com.br) — fallback live, sem auth, CORS aberto
 *
 * Uso típico: getFxRate('USD', '2026-05-19') → 5.43 (1 USD = 5.43 BRL)
 * BRL retorna 1 sempre. Moeda desconhecida retorna 1 com warning.
 */

import { supabase } from '@/integrations/supabase/client';

const memoryCache = new Map<string, number>(); // key: `${currency}|${date}` → rate

function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

async function fetchFromAwesomeApi(currency: string, date: string): Promise<number | null> {
    try {
        const today = todayISO();
        // Endpoint live (cotação atual) — usado quando date === hoje OU não temos histórico
        if (date === today) {
            const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${currency}-BRL`);
            if (!res.ok) return null;
            const data = await res.json();
            const key = `${currency}BRL`;
            const bid = parseFloat(data?.[key]?.bid);
            return Number.isFinite(bid) ? bid : null;
        }

        // Endpoint histórico: /json/daily/USD-BRL/1?start_date=YYYYMMDD&end_date=YYYYMMDD
        const compact = date.replace(/-/g, '');
        const res = await fetch(
            `https://economia.awesomeapi.com.br/json/daily/${currency}-BRL/1?start_date=${compact}&end_date=${compact}`
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            const bid = parseFloat(data[0]?.bid);
            return Number.isFinite(bid) ? bid : null;
        }
        return null;
    } catch (err) {
        console.warn('[fxRates] AwesomeAPI fetch failed:', err);
        return null;
    }
}

/**
 * Busca a cotação de `currency` → BRL na data informada (default hoje).
 * Tenta memória → Supabase → AwesomeAPI. Persiste no Supabase quando vem da API.
 * Retorna 1 se currency === 'BRL' ou se tudo falhou.
 */
export async function getFxRate(currency: string, date?: string): Promise<number> {
    const cur = (currency || '').toUpperCase();
    if (!cur || cur === 'BRL') return 1;

    const d = date || todayISO();
    const cacheKey = `${cur}|${d}`;

    const cached = memoryCache.get(cacheKey);
    if (cached !== undefined) return cached;

    // Tenta Supabase
    try {
        const { data } = await (supabase as any)
            .from('fx_rates')
            .select('rate')
            .eq('currency', cur)
            .eq('date', d)
            .maybeSingle();
        if (data?.rate) {
            const r = Number(data.rate);
            memoryCache.set(cacheKey, r);
            return r;
        }
    } catch (err) {
        console.warn('[fxRates] Supabase read failed:', err);
    }

    // Fallback: AwesomeAPI
    const live = await fetchFromAwesomeApi(cur, d);
    if (live && live > 0) {
        memoryCache.set(cacheKey, live);
        // Persiste (best-effort — não bloqueia retorno)
        (supabase as any)
            .from('fx_rates')
            .upsert({ date: d, currency: cur, rate: live, source: 'awesomeapi' }, { onConflict: 'date,currency' })
            .then(({ error }: any) => {
                if (error) console.warn('[fxRates] Failed to persist:', error.message);
            });
        return live;
    }

    // Última cotação conhecida (fallback de segurança)
    try {
        const { data } = await (supabase as any)
            .from('fx_rates')
            .select('rate, date')
            .eq('currency', cur)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (data?.rate) {
            const r = Number(data.rate);
            console.warn(`[fxRates] Usando cotação de ${data.date} para ${cur} (sem cotação para ${d})`);
            memoryCache.set(cacheKey, r);
            return r;
        }
    } catch (err) {
        console.warn('[fxRates] Fallback to latest known rate failed:', err);
    }

    console.warn(`[fxRates] Sem cotação disponível para ${cur} em ${d}. Retornando 1 (sem conversão).`);
    return 1;
}

/**
 * Busca cotações para várias moedas de uma vez (em paralelo).
 * Retorna um Record<currency, rate>. BRL sempre 1.
 */
export async function getFxRates(currencies: string[], date?: string): Promise<Record<string, number>> {
    const unique = Array.from(new Set(currencies.map(c => (c || '').toUpperCase()).filter(Boolean)));
    const entries = await Promise.all(unique.map(async (cur) => [cur, await getFxRate(cur, date)] as const));
    return Object.fromEntries(entries);
}
