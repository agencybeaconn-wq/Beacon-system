import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Eye, FileCheck, CheckCircle2, Play, FileText, ArrowRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    id: 1,
    name: 'VALIDATE',
    icon: ShieldCheck,
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    title: 'Asserções pré-flight',
    description: 'Confirma que cliente existe, Shopify conectada, pricing configurado e todas as entidades-alvo existem. Se qualquer assert falhar, para imediatamente.',
    examples: [
      'assertClientExists("De Boleiro")',
      'assertShopifyConnected(client)',
      'assertCollectionExists(shop, token, "brasileirao")',
      'assertPricingConfigured(pricing, ["torcedor"])',
    ],
  },
  {
    id: 2,
    name: 'DRY-RUN',
    icon: Eye,
    color: 'bg-purple-500/10 text-purple-600 border-purple-200',
    title: 'Calcular sem aplicar',
    description: 'Roda toda a lógica em modo read-only. Gera o diff/plano completo. Funções de escrita têm default { mode: "dry" } — precisa do user passar { mode: "apply" } explicitamente.',
    examples: [
      'const plan = await buildPlan({ mode: "dry" });',
      'plan.changes = [{id, oldPrice, newPrice}, ...]',
      'plan.summary = { totalAffected, byCategory }',
    ],
  },
  {
    id: 3,
    name: 'PREVIEW',
    icon: FileCheck,
    color: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
    title: 'Mostrar ao user',
    description: 'Exibe resumo em markdown com quantidade total, breakdown por categoria, e amostra de 5 mudanças concretas. **Obrigatório** — sem preview, não executa.',
    examples: [
      '"1.165 produtos, 13.752 variantes"',
      '"Por categoria: torcedor 611, retrô 178..."',
      '"Amostra: Camisa Flamengo R$209 → R$219 (2GG)"',
    ],
  },
  {
    id: 4,
    name: 'CONFIRM',
    icon: CheckCircle2,
    color: 'bg-amber-500/10 text-amber-600 border-amber-200',
    title: 'Aguardar aprovação',
    description: 'Espera resposta explícita do user ("sim"/"pode"/"aplica"). Silêncio ≠ confirmação. Mesmo se o user disse "aplica direto" no pedido inicial, Claude deve mostrar preview primeiro.',
    examples: [
      'User: "pode aplicar"',
      'User: "sim, tá certo"',
      'User: "confirma"',
    ],
  },
  {
    id: 5,
    name: 'EXECUTE',
    icon: Play,
    color: 'bg-green-500/10 text-green-600 border-green-200',
    title: 'Rodar com rate limit',
    description: 'Aplica a mudança respeitando paralelismo: mesma loja → serialize (500ms+), lojas diferentes → paralelo OK. Se der 429, retenta com backoff.',
    examples: [
      'Mesma loja: concurrency 3, delay 500ms',
      'Lojas diferentes: paralelo OK',
      'Read-only: sempre paralelo',
    ],
  },
  {
    id: 6,
    name: 'LOG',
    icon: FileText,
    color: 'bg-gray-500/10 text-gray-600 border-gray-200',
    title: 'Append em execution.jsonl',
    description: 'Cada execução completa gera 1 linha em .claude/logs/execution.jsonl. Permite auditar "o que rodei ontem no cliente X". Log é por máquina, gitignored.',
    examples: [
      '{"ts":"2026-04-10T22:15:00Z","skill":"update-prices","client_id":"...","affected":1165,"ok":1165,"fail":0}',
    ],
  },
];

export function ProtocolView() {
  return (
    <div className="space-y-6">
      {/* Intro */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Protocolo de Execução
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Toda skill que modifica estado (Shopify, Supabase, filesystem) segue este protocolo padrão.
            O objetivo é <strong>zero alucinação em produção</strong>: cada passo é uma barreira de segurança.
            Arquivo de referência: <code className="text-xs bg-muted px-1 rounded">.claude/PROTOCOL.md</code>
          </p>
        </CardContent>
      </Card>

      {/* Flow */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          return (
            <Card key={step.id} className={cn('border-l-4', step.color.split(' ')[2])}>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm', step.color)}>
                    {step.id}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm">{step.name}</h3>
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.title}</p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-foreground/80">{step.description}</p>
                {step.examples && step.examples.length > 0 && (
                  <div className="pt-2 border-t space-y-1">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Exemplos</p>
                    {step.examples.map((ex, i) => (
                      <code key={i} className="block text-[10px] bg-muted/50 px-2 py-1 rounded text-foreground/70">
                        {ex}
                      </code>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Exceptions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Quando uma etapa pode ser pulada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Etapa</th>
                <th className="py-2 pr-4">Pode pular?</th>
                <th className="py-2">Quando</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b"><td className="py-2 pr-4 font-mono">VALIDATE</td><td className="py-2 pr-4"><Badge variant="destructive">Nunca</Badge></td><td className="py-2 text-muted-foreground">—</td></tr>
              <tr className="border-b"><td className="py-2 pr-4 font-mono">DRY-RUN</td><td className="py-2 pr-4"><Badge variant="secondary">Raramente</Badge></td><td className="py-2 text-muted-foreground">Operações 1:1 triviais (ex: /create-discount com preset)</td></tr>
              <tr className="border-b"><td className="py-2 pr-4 font-mono">PREVIEW</td><td className="py-2 pr-4"><Badge variant="secondary">Raramente</Badge></td><td className="py-2 text-muted-foreground">idem (sem ambiguidade)</td></tr>
              <tr className="border-b"><td className="py-2 pr-4 font-mono">CONFIRM</td><td className="py-2 pr-4"><Badge variant="destructive">Nunca</Badge></td><td className="py-2 text-muted-foreground">—</td></tr>
              <tr className="border-b"><td className="py-2 pr-4 font-mono">EXECUTE</td><td className="py-2 pr-4">—</td><td className="py-2 text-muted-foreground">—</td></tr>
              <tr><td className="py-2 pr-4 font-mono">LOG</td><td className="py-2 pr-4"><Badge variant="destructive">Nunca</Badge></td><td className="py-2 text-muted-foreground">—</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-3 italic">
            Quando em dúvida, <strong>não pule</strong>. Fricção extra é melhor que alucinação em produção.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
