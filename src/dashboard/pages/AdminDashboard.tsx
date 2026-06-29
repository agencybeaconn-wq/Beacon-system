import OverviewClone from "@/pages/OverviewClone";

/**
 * Dashboard do ADMIN.
 *
 * Slot 4 do topo: Comissão (auto, via isClient=false em PermissionsContext).
 * Não força clientId — admin pode selecionar qualquer cliente via DashboardContext,
 * inclusive o cliente interno "Lever" (que ativa o agency aggregate view).
 *
 * Por enquanto envolve `<OverviewClone />` direto — nas Fases 2-3 os blocos
 * do body serão extraídos e esta página passará a compor blocos diretamente.
 */
export default function AdminDashboard() {
    return <OverviewClone />;
}
