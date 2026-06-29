import OverviewClone from "@/pages/OverviewClone";

/**
 * Dashboard de KPI do FUNCIONARIO (agency operator).
 *
 * Sufixo `Kpi` pra não colidir com o hub-de-cards legado em
 * `src/pages/agency/AgencyDashboard.tsx` (welcome page com cards
 * "Nova Demanda / Quadro Geral / Minhas Tarefas / Ferramentas").
 *
 * Por enquanto idêntica ao Admin — slot 4 mostra Comissão.
 * Quando a Fase 2/3 quebrar o body, esta página decidirá quais blocos
 * mostrar conforme as permissions do funcionário (sem WeeklyReport,
 * sem SupplierPaymentsDialog, etc).
 */
export default function AgencyDashboardKpi() {
    return <OverviewClone />;
}
