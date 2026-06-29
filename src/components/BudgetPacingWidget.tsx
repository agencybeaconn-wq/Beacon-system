import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/authorityUtils";
import { useTranslation } from "react-i18next";

interface BudgetPacingWidgetProps {
  accountId: string | null;
  currentSpend: number;
  currency?: string;
}

interface BudgetConfig {
  accountId: string;
  monthlyBudget: number;
  month: string; // YYYY-MM
}

const BudgetPacingWidget = ({ accountId, currentSpend, currency = 'BRL' }: BudgetPacingWidgetProps) => {
  const { t, i18n } = useTranslation();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig | null>(null);

  // Calcular informações do mês atual (TIMEZONE AWARE)
  const monthInfo = useMemo(() => {
    try {
      // 🔥 TIMEZONE AWARE: Usar timezone do Brasil para calcular corretamente o dia atual
      const now = new Date();

      // Obter data no timezone do Brasil usando Intl
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const parts = formatter.formatToParts(now);

      const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
      const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1; // month é 0-indexed
      const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');

      const currentMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
      const totalDays = new Date(year, month + 1, 0).getDate();
      const currentDay = day;

      return { currentMonth, totalDays, currentDay };
    } catch (error) {
      // Fallback: usar data local se Intl falhar
      console.warn('Erro ao calcular mês no timezone do Brasil, usando local:', error);
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const currentMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
      const totalDays = new Date(year, month + 1, 0).getDate();
      const currentDay = now.getDate();

      return { currentMonth, totalDays, currentDay };
    }
  }, []);

  // Carregar configuração do localStorage
  useEffect(() => {
    if (!accountId) return;

    const storageKey = `budget_config_${accountId}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        const config = JSON.parse(stored) as BudgetConfig;
        // Verificar se é do mês atual, senão limpar
        if (config.month === monthInfo.currentMonth) {
          setBudgetConfig(config);
        } else {
          // Novo mês - limpar configuração antiga
          localStorage.removeItem(storageKey);
          setBudgetConfig(null);
        }
      } catch (error) {
        console.error('Erro ao carregar configuração de budget:', error);
      }
    }
  }, [accountId, monthInfo.currentMonth]);

  // Salvar configuração
  const handleSaveBudget = () => {
    if (!accountId || !budgetInput) return;

    const budgetValue = parseFloat(budgetInput.replace(/[^\d,.-]/g, '').replace(',', '.'));

    if (isNaN(budgetValue) || budgetValue <= 0) {
      alert(t('budget.invalid_value', 'Please enter a valid value'));
      return;
    }

    const config: BudgetConfig = {
      accountId,
      monthlyBudget: budgetValue,
      month: monthInfo.currentMonth,
    };

    const storageKey = `budget_config_${accountId}`;
    localStorage.setItem(storageKey, JSON.stringify(config));
    setBudgetConfig(config);
    setIsConfigOpen(false);
    setBudgetInput("");
  };

  // Calcular métricas de pacing
  const pacingMetrics = useMemo(() => {
    if (!budgetConfig) return null;

    const { monthlyBudget } = budgetConfig;
    const { totalDays, currentDay } = monthInfo;

    // Pacing Ideal Linear: (Budget / Dias Totais) * Dia Atual
    const idealPacing = (monthlyBudget / totalDays) * currentDay;

    // Diferença entre gasto real e ideal
    const difference = currentSpend - idealPacing;
    const differencePercent = idealPacing > 0 ? (difference / idealPacing) * 100 : 0;

    // Progresso em relação ao budget total
    const progressPercent = (currentSpend / monthlyBudget) * 100;
    const idealProgressPercent = (idealPacing / monthlyBudget) * 100;

    // Status baseado em thresholds
    let status: 'critical' | 'overpacing' | 'healthy' | 'underpacing' = 'healthy';
    let statusColor = 'text-green-600';
    let barColor = 'bg-green-600';
    let statusIcon = CheckCircle2;
    let statusText = 'Dentro da Meta';

    if (currentSpend > monthlyBudget) {
      status = 'critical';
      statusColor = 'text-purple-600';
      barColor = 'bg-purple-600';
      statusIcon = AlertTriangle;
      statusText = t('budget.status_critical', 'Budget Exceeded');
    } else if (differencePercent > 10) {
      status = 'overpacing';
      statusColor = 'text-primary';
      barColor = 'bg-primary';
      statusIcon = TrendingUp;
      statusText = t('budget.status_overpacing', 'Overpacing');
    } else if (differencePercent < -10) {
      status = 'underpacing';
      statusColor = 'text-sky-500';
      barColor = 'bg-sky-500';
      statusIcon = TrendingDown;
      statusText = t('budget.status_underpacing', 'Underpacing');
    }

    if (status === 'healthy' && !statusText) {
      statusText = t('budget.status_healthy', 'In Target');
    }

    return {
      idealPacing,
      difference,
      differencePercent,
      progressPercent: Math.min(progressPercent, 100),
      idealProgressPercent,
      status,
      statusColor,
      barColor,
      statusIcon: statusIcon,
      statusText,
      remainingBudget: monthlyBudget - currentSpend,
      remainingDays: totalDays - currentDay,
    };
  }, [budgetConfig, currentSpend, monthInfo]);

  // Estado: Sem configuração de budget
  if (!budgetConfig) {
    return (
      <Card className="p-6 border-dashed border-2 border-white/10 bg-secondary/10 backdrop-blur-sm rounded-lg hover:bg-secondary/20 transition-all duration-300">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-md bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5">
              <Settings className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h4 className="font-bold text-base text-foreground">{t('budget.pacing_title', 'Budget Control')}</h4>
              <p className="text-sm text-muted-foreground">{t('budget.pacing_desc', 'Set your monthly budget to track pacing')}</p>
            </div>
          </div>
          <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 rounded-md h-9">
                <Settings className="h-4 w-4 mr-2" />
                {t('budget.setup_button', 'Setup')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-lg">
              <DialogHeader>
                <DialogTitle>{t('budget.setup_title', 'Configure Monthly Budget')}</DialogTitle>
                <DialogDescription>
                  {t('budget.setup_description', { date: new Date().toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' }) })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="budget" className="text-sm font-medium">{t('budget.monthly_budget_label', 'Orçamento Mensal')}</Label>
                  <Input
                    id="budget"
                    type="text"
                    placeholder={t('budget.placeholder', 'Ex: 5000.00')}
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    className="text-lg font-mono rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('budget.helper_text', 'Este valor será usado para calcular o pacing diário ideal')}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsConfigOpen(false)} className="rounded-md">
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button onClick={handleSaveBudget} className="rounded-md">
                  {t('budget.save_button', 'Save Configuration')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Card>
    );
  }

  // Estado: Com configuração ativa
  if (!pacingMetrics) return null;

  const StatusIcon = pacingMetrics.statusIcon;

  return (
    <Card className="p-6 relative overflow-hidden border-white/5 bg-secondary/20 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300 rounded-lg">
      {/* Background gradient baseado no status */}
      <div className={`absolute inset-0 opacity-[0.03] pointer-events-none ${pacingMetrics.status === 'critical' ? 'bg-purple-500' :
        pacingMetrics.status === 'overpacing' ? 'bg-primary' :
          pacingMetrics.status === 'underpacing' ? 'bg-gradient-to-br from-sky-500 to-cyan-600' :
            'bg-gradient-to-br from-emerald-500 to-green-600'
        }`} />

      <div className="relative space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">{t('budget.pacing_title', 'Budget Control')}</h3>
              <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md hover:bg-white/10">
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-lg">
                  <DialogHeader>
                    <DialogTitle>{t('budget.setup_title', 'Editar Orçamento Mensal')}</DialogTitle>
                    <DialogDescription>
                      {t('budget.current_budget_desc', { value: formatCurrency(budgetConfig.monthlyBudget) })}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="budget-edit" className="text-sm font-medium">{t('budget.new_budget_label', 'Novo Orçamento Mensal')}</Label>
                      <Input
                        id="budget-edit"
                        type="text"
                        placeholder={budgetConfig.monthlyBudget.toString()}
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        className="text-lg font-mono rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsConfigOpen(false)} className="rounded-md">
                      {t('common.cancel', 'Cancelar')}
                    </Button>
                    <Button onClick={handleSaveBudget} className="rounded-md">
                      {t('budget.update_button', 'Atualizar')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              {new Date().toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })} • {t('budget.day_info', { current: monthInfo.currentDay, total: monthInfo.totalDays })}
            </p>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border-2 ${pacingMetrics.status === 'critical' ? 'bg-purple-500/10 border-purple-500/30 text-purple-500' :
            pacingMetrics.status === 'overpacing' ? 'bg-primary/10 border-primary/30 text-primary' :
              pacingMetrics.status === 'underpacing' ? 'bg-sky-500/10 border-sky-500/30 text-sky-500' :
                'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
            }`}>
            <StatusIcon className="h-4 w-4" />
            <span className="text-xs font-bold">{pacingMetrics.statusText}</span>
          </div>
        </div>

        {/* Progress Bar com Marcador de Pacing Ideal */}
        <div className="space-y-3">
          <div className="relative">
            {/* Background da barra */}
            <div className="h-12 bg-white/5 rounded-md overflow-hidden relative border border-white/10 shadow-inner">
              {/* Barra de Progresso Principal - Cor sólida e sutil */}
              <div
                className={`h-full rounded-md transition-all duration-500 ${pacingMetrics.status === 'critical' ? 'bg-purple-500' :
                  pacingMetrics.status === 'overpacing' ? 'bg-primary' :
                    pacingMetrics.status === 'underpacing' ? 'bg-sky-500' :
                      'bg-emerald-500'
                  }`}
                style={{ width: `${Math.min(pacingMetrics.progressPercent, 100)}%` }}
              />

              {/* Label de progresso dentro da barra */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {pacingMetrics.progressPercent.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Marcador Vertical do Pacing Ideal (Pino) */}
            <div
              className="absolute top-0 h-12 w-1 bg-foreground/80 z-10 pointer-events-none group shadow-lg"
              style={{ left: `${Math.min(pacingMetrics.idealProgressPercent, 100)}%` }}
              title={`Pacing Ideal: ${formatCurrency(pacingMetrics.idealPacing)}`}
            >
              {/* Marcador Superior */}
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-foreground rounded-full shadow-md" />
              {/* Marcador Inferior */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-foreground rounded-full shadow-md" />
            </div>
          </div>

          {/* Legenda da barra */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">{formatCurrency(0)}</span>
            <span className="text-muted-foreground font-medium">
              {t('budget.goal', 'Goal')}: {formatCurrency(budgetConfig.monthlyBudget)}
            </span>
          </div>
        </div>

        {/* Métricas Detalhadas - Grid de Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <p className="text-xs text-muted-foreground font-medium mb-1.5">{t('budget.actual_spend', 'Actual Spend')}</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(currentSpend)}</p>
          </div>
          <div className="p-4 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <p className="text-xs text-muted-foreground font-medium mb-1.5">{t('budget.ideal_pacing', 'Ideal Pacing')}</p>
            <p className="text-xl font-bold text-muted-foreground/90">{formatCurrency(pacingMetrics.idealPacing)}</p>
          </div>
          <div className="p-4 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <p className="text-xs text-muted-foreground font-medium mb-1.5">{t('budget.difference', 'Difference')}</p>
            <p className={`text-xl font-bold ${pacingMetrics.status === 'critical' ? 'text-purple-500' :
              pacingMetrics.status === 'overpacing' ? 'text-primary' :
                pacingMetrics.status === 'underpacing' ? 'text-sky-500' :
                  'text-emerald-500'
              }`}>
              {pacingMetrics.difference > 0 ? '+' : ''}{formatCurrency(pacingMetrics.difference)}
            </p>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              ({pacingMetrics.differencePercent > 0 ? '+' : ''}{pacingMetrics.differencePercent.toFixed(1)}%)
            </p>
          </div>
          <div className="p-4 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <p className="text-xs text-muted-foreground font-medium mb-1.5">{t('budget.available', 'Available')}</p>
            <p className={`text-xl font-bold ${pacingMetrics.remainingBudget < 0 ? 'text-purple-500' : 'text-emerald-500'
              }`}>
              {formatCurrency(Math.max(0, pacingMetrics.remainingBudget))}
            </p>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              {t('budget.remaining_days', { count: pacingMetrics.remainingDays })}
            </p>
          </div>
        </div>

        {/* Recomendação baseada no status */}
        {pacingMetrics.status !== 'healthy' && (
          <div className={`p-4 rounded-lg border-2 ${pacingMetrics.status === 'critical' ? 'bg-purple-500/10 border-purple-500/30' :
            pacingMetrics.status === 'overpacing' ? 'bg-primary/10 border-primary/30' :
              'bg-sky-500/10 border-sky-500/30'
            }`}>
            <p className="text-sm font-medium leading-relaxed">
              {pacingMetrics.status === 'critical' && t('budget.recommendations.critical', '⚠️ Ação Necessária: Orçamento excedido. Considere pausar campanhas de baixo ROAS.')}
              {pacingMetrics.status === 'overpacing' && t('budget.recommendations.overpacing', '📊 Atenção: Gasto acelerado. Você está gastando mais rápido que o planejado. Monitore de perto.')}
              {pacingMetrics.status === 'underpacing' && t('budget.recommendations.underpacing', '💡 Oportunidade: Gasto abaixo do ritmo. Considere aumentar lances ou expandir audiências.')}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default BudgetPacingWidget;
