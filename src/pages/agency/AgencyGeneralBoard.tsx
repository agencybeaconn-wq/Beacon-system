import { TasksView } from "@/components/lever-os/TasksView";
import { useDashboard, useSelectedClient } from "@/contexts/DashboardContext";
import { useSearchParams } from "react-router-dom";

const VALID_TYPES = ['fixo', 'avulso'] as const;
type ProjectTypeFilter = typeof VALID_TYPES[number];

export default function AgencyGeneralBoard() {
    const { workspaceId } = useDashboard();
    const { selectedClientId, selectedClientName } = useSelectedClient();
    const [searchParams] = useSearchParams();

    const rawType = searchParams.get('type');
    const projectTypeFilter: ProjectTypeFilter | undefined =
        rawType && (VALID_TYPES as readonly string[]).includes(rawType)
            ? (rawType as ProjectTypeFilter)
            : undefined;

    const typeLabel =
        projectTypeFilter === 'fixo' ? 'Fixo (MRR)'
        : projectTypeFilter === 'avulso' ? 'Avulso'
        : null;

    const baseTitle = selectedClientId && selectedClientName
        ? `Demandas: ${selectedClientName}`
        : "Quadro Geral";
    const pageTitle = typeLabel ? `${baseTitle} — ${typeLabel}` : baseTitle;

    const baseDescription = selectedClientId && selectedClientName
        ? `Gerenciamento de demandas e tarefas para ${selectedClientName}.`
        : "Visão unificada de todas as demandas de todos os clientes.";
    const pageDescription = typeLabel ? `${baseDescription} · filtrado por ${typeLabel}` : baseDescription;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">
                        {pageTitle}
                    </h1>
                    <p className="text-muted-foreground mt-1 max-w-2xl">
                        {pageDescription}
                    </p>
                </div>
            </div>

            <div className="w-full min-h-[600px]">
                <TasksView
                    title={pageTitle}
                    showClientName={!selectedClientId}
                    readOnly={false}
                    projectTypeFilter={projectTypeFilter}
                />
            </div>
        </div>
    );
}
