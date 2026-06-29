/**
 * DREGerencialView — DRE Gerencial Mensal + Rentabilidade por Projeto
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Percent,
  Clock,
  TrendingUp,
  TrendingDown,
  Loader2,
} from 'lucide-react';
import { useDREGerencial, type DREGerencialData } from '@/hooks/useDREGerencial';
import type { MemberFinancial, FinancialExpense, ClientInvoice, PartnerProlabore } from '@/hooks/useFinancials';

// =============================================================================
// PROPS
// =============================================================================

interface DREGerencialViewProps {
  clients: any[];
  staffFinancials: MemberFinancial[];
  expenses: FinancialExpense[];
  invoices: ClientInvoice[];
  partnersProlabore: PartnerProlabore[];
  salesTotal: number;
  workspaceId: string | null;
}

// =============================================================================
// HELPERS
// =============================================================================

const fmt = (val: number) =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPct = (val: number) => `${val.toFixed(1)}%`;

// =============================================================================
// COMPONENT
// =============================================================================

export function DREGerencialView({
  clients,
  staffFinancials,
  expenses,
  invoices,
  partnersProlabore,
  salesTotal,
  workspaceId,
}: DREGerencialViewProps) {
  const [taxPercent, setTaxPercent] = useState(6);
  const taxRate = taxPercent / 100;

  const { dre, projectCosts, memberHourlyRates, isLoading } = useDREGerencial({
    clients,
    staffFinancials,
    expenses,
    invoices,
    partnersProlabore,
    salesTotal,
    workspaceId,
    taxRate,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Imposto Global */}
      <Card className="p-5 border border-border/50 bg-background/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Percent className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-bold">Alíquota de Imposto</p>
              <p className="text-xs text-muted-foreground">Incide sobre o faturamento bruto</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={taxPercent}
              onChange={(e) => setTaxPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
              className="h-9 w-20 text-center text-sm font-bold rounded-lg border border-border bg-background"
            />
            <span className="text-sm text-muted-foreground font-medium">%</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* DRE Mensal */}
        <Card className="p-8 border border-border/50 bg-background/50">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold">DRE Gerencial</h3>
              <p className="text-sm text-muted-foreground">Demonstrativo de Resultado Gerencial</p>
            </div>
            <Badge variant="outline" className="text-xs uppercase px-3 py-1">Mensal</Badge>
          </div>

          <div className="space-y-6">
            {/* Receita Bruta */}
            <DRESection title="Receita Bruta" icon={<ArrowUpRight className="h-3 w-3 text-emerald-500" />}>
              <DRELine label="Faturamento (MRR + Avulsos)" value={dre.receitaBruta} color="emerald" />
            </DRESection>

            {/* Deduções */}
            <DRESection title="(-) Deduções sobre Receita" icon={<ArrowDownRight className="h-3 w-3 text-amber-500" />}>
              <DRELine label={`Impostos (${taxPercent}%)`} value={-dre.deducoes} color="amber" />
            </DRESection>

            {/* Receita Líquida */}
            <DRETotalLine label="= Receita Líquida" value={dre.receitaLiquida} highlight="blue" />

            {/* CSP */}
            <DRESection title="(-) Custo do Serviço Prestado (CSP)" icon={<ArrowDownRight className="h-3 w-3 text-red-500" />}>
              <DRELine label="Custo de Execução (horas × valor-hora)" value={-(dre.csp - expenses.filter(e => e.recurrence_type === 'variable').reduce((a, e) => a + (e.amount || 0), 0))} color="red" />
              <DRELine label="Despesas Variáveis" value={-expenses.filter(e => e.recurrence_type === 'variable').reduce((a, e) => a + (e.amount || 0), 0)} color="red" />
            </DRESection>

            {/* Margem de Contribuição */}
            <DRETotalLine label="= Margem de Contribuição" value={dre.margemContribuicao} highlight={dre.margemContribuicao >= 0 ? "emerald" : "red"} />

            {/* Despesas Fixas */}
            <DRESection title="(-) Despesas Fixas" icon={<ArrowDownRight className="h-3 w-3 text-red-500" />}>
              <DRELine label="Folha de Pagamento (Salários)" value={-staffFinancials.reduce((a, m) => a + (m.base_salary || 0), 0)} color="red" />
              <DRELine label="Pró-labore (Sócios)" value={-partnersProlabore.filter(p => p.status === 'active').reduce((a, p) => a + (p.amount || 0), 0)} color="red" />
              <DRELine label="Despesas Fixas (Ferramentas, SaaS, etc)" value={-expenses.filter(e => e.recurrence_type === 'fixed').reduce((a, e) => a + (e.amount || 0), 0)} color="red" />
            </DRESection>

            <Separator className="my-4" />

            {/* Lucro Operacional */}
            <div className="p-6 rounded-xl border space-y-2"
              style={{ backgroundColor: dre.lucroOperacional >= 0 ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', borderColor: dre.lucroOperacional >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-full", dre.lucroOperacional >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
                    <PieChart className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold">Lucro Líquido Operacional</p>
                    <p className="text-xs text-muted-foreground">Resultado após todos os custos e despesas</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("text-2xl font-black", dre.lucroOperacional >= 0 ? "text-emerald-500" : "text-red-500")}>
                    {fmt(dre.lucroOperacional)}
                  </p>
                  <Badge className={cn("mt-1", dre.margemOperacional >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
                    {fmtPct(dre.margemOperacional)} Margem
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Sidebar: Valor-hora por Membro */}
        <div className="space-y-6">
          <Card className="p-6 border border-border/50 bg-background/50">
            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Valor-Hora da Equipe
            </h4>
            <div className="space-y-3">
              {memberHourlyRates.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum membro com salário cadastrado.</p>
              )}
              {memberHourlyRates.map((m) => (
                <div key={m.memberId} className="flex items-center justify-between text-sm">
                  <span className="truncate max-w-[140px]">{m.name}</span>
                  <div className="text-right">
                    <span className="font-bold">{fmt(m.hourlyRate)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">/h</span>
                  </div>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="text-[10px] text-muted-foreground">
              Cálculo: Salário ÷ {MONTHLY_HOURS}h úteis/mês
            </div>
          </Card>
        </div>
      </div>

      {/* Rentabilidade por Projeto */}
      <Card className="p-6 border border-border/50 bg-background/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold">Rentabilidade por Projeto</h3>
            <p className="text-xs text-muted-foreground">Custo de execução baseado nas horas do onboarding × valor-hora</p>
          </div>
        </div>

        {projectCosts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum projeto com dados suficientes para análise.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border/30 bg-muted/10">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Projeto</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Contrato</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Horas</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Custo Exec.</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Impostos</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lucro</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Margem</th>
                </tr>
              </thead>
              <tbody>
                {projectCosts.map((p, idx) => (
                  <tr key={p.clientId} className={cn("border-b border-border/10", idx % 2 === 1 && "bg-muted/5")}>
                    <td className="px-4 py-3 text-sm font-medium">{p.clientName}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">{fmt(p.contractValue)}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-muted-foreground">{p.totalHours}h</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-red-400">{fmt(p.executionCost)}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-amber-400">{fmt(p.taxDeduction)}</td>
                    <td className={cn("px-4 py-3 text-sm text-right tabular-nums font-bold", p.profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {fmt(p.profit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge className={cn("text-[10px]", p.margin >= 30 ? "bg-emerald-500/10 text-emerald-500" : p.margin >= 0 ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500")}>
                        {fmtPct(p.margin)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border/30 bg-muted/10">
                  <td className="px-4 py-3 text-sm font-bold">Total</td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums font-bold">{fmt(projectCosts.reduce((a, p) => a + p.contractValue, 0))}</td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums font-bold text-muted-foreground">{projectCosts.reduce((a, p) => a + p.totalHours, 0).toFixed(1)}h</td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums font-bold text-red-400">{fmt(projectCosts.reduce((a, p) => a + p.executionCost, 0))}</td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums font-bold text-amber-400">{fmt(projectCosts.reduce((a, p) => a + p.taxDeduction, 0))}</td>
                  <td className={cn("px-4 py-3 text-sm text-right tabular-nums font-bold", projectCosts.reduce((a, p) => a + p.profit, 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {fmt(projectCosts.reduce((a, p) => a + p.profit, 0))}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const MONTHLY_HOURS = 160;

function DRESection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
        {icon} {title}
      </h4>
      {children}
    </div>
  );
}

function DRELine({ label, value, color }: { label: string; value: number; color: 'emerald' | 'red' | 'amber' | 'blue' }) {
  const colorClass = {
    emerald: 'text-emerald-500',
    red: 'text-red-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
  }[color];

  return (
    <div className="flex justify-between items-center py-1.5 px-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("font-medium text-sm tabular-nums", colorClass)}>
        {value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value)}
      </span>
    </div>
  );
}

function DRETotalLine({ label, value, highlight }: { label: string; value: number; highlight: 'emerald' | 'red' | 'blue' }) {
  const bgClass = {
    emerald: 'bg-emerald-500/5 border-emerald-500/10',
    red: 'bg-red-500/5 border-red-500/10',
    blue: 'bg-blue-500/5 border-blue-500/10',
  }[highlight];

  const textClass = {
    emerald: 'text-emerald-500',
    red: 'text-red-500',
    blue: 'text-blue-400',
  }[highlight];

  return (
    <div className={cn("flex justify-between items-center py-3 px-3 rounded-lg border", bgClass)}>
      <span className="font-bold text-sm">{label}</span>
      <span className={cn("font-bold text-lg tabular-nums", textClass)}>{fmt(value)}</span>
    </div>
  );
}
