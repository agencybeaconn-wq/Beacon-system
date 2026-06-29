import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

type QualityRun = {
  id: string;
  client_id: string;
  run_at: string;
  score: number;
  counts: { PASS: number; WARN: number; FAIL: number; SKIP: number };
  results?: any[];
  elapsed_seconds: number;
  triggered_by: string;
};

type ClientWithRun = {
  id: string;
  name: string;
  shopify_domain: string;
  latestRun: QualityRun | null;
  previousRun: QualityRun | null;
  trend: 'up' | 'down' | 'flat' | 'none';
};

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function scoreIcon(score: number) {
  if (score >= 80) return CheckCircle2;
  if (score >= 60) return AlertTriangle;
  return XCircle;
}

export function QualityDashboard() {
  const [clients, setClients] = useState<ClientWithRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // Busca clientes conectados
      const { data: clientsData, error: clientsError } = await supabase
        .from('agency_clients')
        .select('id, name, shopify_domain')
        .eq('shopify_status', 'connected')
        .order('name');

      if (clientsError) throw clientsError;

      // Busca as 2 runs mais recentes de cada cliente
      const clientsWithRuns: ClientWithRun[] = [];
      for (const c of (clientsData || [])) {
        const { data: runs } = await supabase
          .from('client_quality_runs' as any)
          .select('*')
          .eq('client_id', c.id)
          .order('run_at', { ascending: false })
          .limit(2);

        const latestRun = (runs?.[0] as QualityRun) || null;
        const previousRun = (runs?.[1] as QualityRun) || null;

        let trend: ClientWithRun['trend'] = 'none';
        if (latestRun && previousRun) {
          if (latestRun.score > previousRun.score) trend = 'up';
          else if (latestRun.score < previousRun.score) trend = 'down';
          else trend = 'flat';
        }

        clientsWithRuns.push({
          id: c.id,
          name: c.name,
          shopify_domain: c.shopify_domain,
          latestRun,
          previousRun,
          trend,
        });
      }

      // Ordena: piores scores primeiro (pra atenção), depois clientes sem run
      clientsWithRuns.sort((a, b) => {
        if (!a.latestRun && !b.latestRun) return 0;
        if (!a.latestRun) return 1;
        if (!b.latestRun) return -1;
        return a.latestRun.score - b.latestRun.score;
      });

      setClients(clientsWithRuns);
    } catch (e: any) {
      console.error('Erro ao carregar quality runs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = {
    total: clients.length,
    withRuns: clients.filter(c => c.latestRun).length,
    critical: clients.filter(c => c.latestRun && c.latestRun.score < 60).length,
    good: clients.filter(c => c.latestRun && c.latestRun.score >= 80).length,
  };

  return (
    <div className="space-y-4">
      {/* Header + Refresh */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="w-5 h-5 text-primary" />
              Quality Gate Dashboard
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scores de saúde das lojas dos clientes baseados nos 14 checks do <code className="text-xs bg-muted px-1 rounded">/quality-gate</code>.
            Rode <code className="text-xs bg-muted px-1 rounded">node .claude/skills/quality-gate/run-weekly.mjs</code> pra popular todos os clientes de uma vez.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total clientes</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Com run</p>
              <p className="text-2xl font-bold">{stats.withRuns}</p>
            </div>
            <div className="rounded-lg border p-3 border-green-200 bg-green-50 dark:bg-green-500/5">
              <p className="text-xs text-green-700">Saudáveis (≥80)</p>
              <p className="text-2xl font-bold text-green-600">{stats.good}</p>
            </div>
            <div className="rounded-lg border p-3 border-red-200 bg-red-50 dark:bg-red-500/5">
              <p className="text-xs text-red-700">Críticos (&lt;60)</p>
              <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client list */}
      {loading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Nenhum cliente conectado encontrado.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b bg-muted/30">
                <tr className="text-left text-xs font-semibold text-muted-foreground">
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Checks</th>
                  <th className="py-3 px-4">Última run</th>
                  <th className="py-3 px-4">Tendência</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => {
                  if (!c.latestRun) {
                    return (
                      <tr key={c.id} className="border-b">
                        <td className="py-3 px-4 text-sm font-medium">{c.name}</td>
                        <td className="py-3 px-4 text-xs text-muted-foreground" colSpan={4}>
                          Nunca rodou quality-gate
                        </td>
                      </tr>
                    );
                  }
                  const Icon = scoreIcon(c.latestRun.score);
                  const isExpanded = expandedClient === c.id;
                  return (
                    <>
                      <tr
                        key={c.id}
                        className="border-b hover:bg-muted/30 cursor-pointer"
                        onClick={() => setExpandedClient(isExpanded ? null : c.id)}
                      >
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">{c.shopify_domain}</p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Icon className={cn('w-4 h-4', scoreColor(c.latestRun.score))} />
                            <span className={cn('text-lg font-bold', scoreColor(c.latestRun.score))}>{c.latestRun.score}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            <Badge variant="outline" className="text-[10px] h-5 bg-green-500/10 text-green-700 border-green-200">
                              {c.latestRun.counts.PASS} PASS
                            </Badge>
                            {c.latestRun.counts.WARN > 0 && (
                              <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-700 border-amber-200">
                                {c.latestRun.counts.WARN} WARN
                              </Badge>
                            )}
                            {c.latestRun.counts.FAIL > 0 && (
                              <Badge variant="outline" className="text-[10px] h-5 bg-red-500/10 text-red-700 border-red-200">
                                {c.latestRun.counts.FAIL} FAIL
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {new Date(c.latestRun.run_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4">
                          {c.trend === 'up' && <span className="inline-flex items-center gap-1 text-green-600 text-xs"><TrendingUp className="w-3 h-3" /> Melhorando</span>}
                          {c.trend === 'down' && <span className="inline-flex items-center gap-1 text-red-600 text-xs"><TrendingDown className="w-3 h-3" /> Piorando</span>}
                          {c.trend === 'flat' && <span className="inline-flex items-center gap-1 text-muted-foreground text-xs"><Minus className="w-3 h-3" /> Estável</span>}
                          {c.trend === 'none' && <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>
                      {isExpanded && c.latestRun.results && (
                        <tr key={c.id + '-expanded'} className="bg-muted/10">
                          <td colSpan={5} className="p-4">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold mb-2">Detalhamento dos checks:</p>
                              {c.latestRun.results.map((r: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <Badge variant="outline" className={cn(
                                    'text-[10px] w-12 justify-center',
                                    r.verdict === 'PASS' && 'bg-green-500/10 text-green-700',
                                    r.verdict === 'WARN' && 'bg-amber-500/10 text-amber-700',
                                    r.verdict === 'FAIL' && 'bg-red-500/10 text-red-700',
                                    r.verdict === 'SKIP' && 'bg-gray-500/10 text-gray-600',
                                  )}>
                                    {r.verdict}
                                  </Badge>
                                  <span className="font-medium">{r.label}:</span>
                                  <span className="text-muted-foreground">{r.detail}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
