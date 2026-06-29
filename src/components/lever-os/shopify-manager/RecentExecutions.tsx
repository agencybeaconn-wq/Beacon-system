import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, RefreshCw, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type QualityRun = {
  id: string;
  client_id: string;
  run_at: string;
  score: number;
  counts: { PASS: number; WARN: number; FAIL: number; SKIP: number };
  elapsed_seconds: number;
  triggered_by: string;
};

type EnrichedRun = QualityRun & { clientName?: string };

export function RecentExecutions() {
  const [runs, setRuns] = useState<EnrichedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerFilter, setTriggerFilter] = useState<string | null>(null);

  const loadRuns = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('client_quality_runs' as any)
        .select('*')
        .order('run_at', { ascending: false })
        .limit(50);

      if (triggerFilter) {
        q = q.eq('triggered_by', triggerFilter);
      }

      const { data: runsData, error } = await q;
      if (error) throw error;

      // Enriquece com client_name
      const clientIds = Array.from(new Set((runsData || []).map((r: any) => r.client_id)));
      if (clientIds.length > 0) {
        const { data: clientsData } = await supabase
          .from('agency_clients')
          .select('id, name')
          .in('id', clientIds);
        const nameMap = new Map((clientsData || []).map(c => [c.id, c.name]));
        setRuns((runsData || []).map((r: any) => ({ ...r, clientName: nameMap.get(r.client_id) })));
      } else {
        setRuns([]);
      }
    } catch (e: any) {
      console.error('Erro:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, [triggerFilter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="w-5 h-5 text-primary" />
              Histórico de Execuções
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadRuns} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Últimas 50 execuções de quality-gate salvas em <code className="text-xs bg-muted px-1 rounded">client_quality_runs</code>.
            Use pra auditar o que rodou e ver tendências por cliente.
          </p>

          <div className="flex gap-2 items-center">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <button
              onClick={() => setTriggerFilter(null)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                triggerFilter === null ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              )}
            >
              Todas
            </button>
            {['manual', 'weekly', 'pre-flight'].map(t => (
              <button
                key={t}
                onClick={() => setTriggerFilter(t)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  triggerFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Nenhuma execução encontrada. Rode <code>/quality-gate &lt;cliente&gt;</code> pra popular.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b bg-muted/30">
                <tr className="text-left text-xs font-semibold text-muted-foreground">
                  <th className="py-2 px-4">Quando</th>
                  <th className="py-2 px-4">Cliente</th>
                  <th className="py-2 px-4">Score</th>
                  <th className="py-2 px-4">Resultado</th>
                  <th className="py-2 px-4">Duração</th>
                  <th className="py-2 px-4">Trigger</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id} className="border-b hover:bg-muted/20">
                    <td className="py-2 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(run.run_at).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 px-4 text-xs font-medium">{run.clientName || run.client_id.slice(0, 8)}</td>
                    <td className="py-2 px-4 text-xs">
                      <span className={cn(
                        'font-bold',
                        run.score >= 80 ? 'text-green-600' : run.score >= 60 ? 'text-amber-600' : 'text-red-600'
                      )}>
                        {run.score}
                      </span>
                      <span className="text-muted-foreground">/100</span>
                    </td>
                    <td className="py-2 px-4 text-xs">
                      <div className="flex gap-1">
                        {run.counts.PASS > 0 && <span className="text-green-600">{run.counts.PASS}P</span>}
                        {run.counts.WARN > 0 && <span className="text-amber-600">{run.counts.WARN}W</span>}
                        {run.counts.FAIL > 0 && <span className="text-red-600">{run.counts.FAIL}F</span>}
                      </div>
                    </td>
                    <td className="py-2 px-4 text-xs text-muted-foreground">{run.elapsed_seconds?.toFixed(0) || '-'}s</td>
                    <td className="py-2 px-4">
                      <Badge variant="outline" className="text-[10px] h-5">{run.triggered_by}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
