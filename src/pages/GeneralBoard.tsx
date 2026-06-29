import { TasksView } from "@/components/lever-os/TasksView";
import { LayoutDashboard } from "lucide-react";

export default function GeneralBoard() {
    return (
        <div className="w-full p-10 h-full min-h-screen flex flex-col">
            <div className="w-full min-h-[calc(100vh-180px)]">
                <TasksView
                    clientId={null}
                    title="Todas as Demandas"
                    showClientName={true}
                    ignoreClientFilter={true}
                    headerTitle="Quadro Geral"
                    headerDescription="Visão unificada de todas as demandas de todos os clientes."
                />
            </div>
        </div>
    );
}
