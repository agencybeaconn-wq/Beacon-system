import { useDashboard } from "@/contexts/DashboardContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { TasksView } from "@/components/lever-os/TasksView";

export default function PortalTasks() {
    const { clientData } = useDashboard();
    const { linkedClientId, linkedClientName } = usePermissions();
    const activeClientId = linkedClientId || clientData?.id;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-tight italic">
                    Demandas
                </h1>
                <p className="text-muted-foreground text-lg">
                    Acompanhe o progresso e o cronograma de entrega do seu squad para <span className="text-primary font-bold">{linkedClientName || clientData?.name || "seu projeto"}</span>.
                </p>
            </div>

            <div className="w-full min-h-[600px]">
                {/* 
                    Usamos o TasksView aqui para dar ao cliente a mesma visão da agência.
                    As permissões dentro do TasksView garantem que o cliente não possa
                    deletar ou criar colunas, mas veja o progresso real.
                */}
                <TasksView
                    clientId={activeClientId}
                    title="Quadro de Demandas"
                    readOnly={true}
                />
            </div>
        </div>
    );
}
