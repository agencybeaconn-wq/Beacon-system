import { TasksView } from "@/components/lever-os/TasksView";
import { ClipboardList, LayoutDashboard } from "lucide-react";
import { useDashboard } from "@/contexts/DashboardContext";
import { AdAccountSelector } from "@/components/AdAccountSelector";
import { useSearchParams } from "react-router-dom";

const VALID_TYPES = ['fixo', 'avulso'] as const;
type ProjectTypeFilter = typeof VALID_TYPES[number];

export default function TasksPage() {
    const { selectedClientName, selectedClientId } = useDashboard();
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

    const baseTitle = selectedClientId ? "Demandas" : "Visão Geral";
    const headerTitle = typeLabel ? `${baseTitle} — ${typeLabel}` : baseTitle;

    const baseDescription = selectedClientName
        ? `Demandas de ${selectedClientName}`
        : "Visão unificada de todas as demandas de todos os clientes.";
    const headerDescription = typeLabel
        ? `${baseDescription} · filtrado por ${typeLabel}`
        : baseDescription;

    return (
        <div className="w-full p-10 h-full min-h-screen flex flex-col">
            <div className="w-full min-h-[calc(100vh-180px)]">
                {/* Se não houver cliente selecionado, mostrar a visualização GLOBAL (Quadro Geral/Visão Geral) */}
                <TasksView
                    headerTitle={headerTitle}
                    headerDescription={headerDescription}
                    clientId={selectedClientId || null}
                    ignoreClientFilter={!selectedClientId} // O mais importante: ignora o filtro se não houver cliente (comportamento nativo do Quadro Geral passado)
                    showClientName={!selectedClientId} // Mostrar as tags com nomes dos clientes na visão geral (já que mistura todos)
                    projectTypeFilter={projectTypeFilter}
                />
            </div>
        </div>
    );
}
