import { ProjectPriorities } from "@/components/lever-os/ProjectPriorities";

/**
 * Página da fila de prioridade de projetos (ADM e colaborador).
 * A lógica vive em ProjectPriorities; aqui é só o chrome da página.
 */
export default function PrioridadesPage() {
    // Sem padding próprio: AgencyLayout já tem p-4/p-8; no ADM a rota envolve.
    return (
        <div className="w-full">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Prioridades</h1>
                <p className="text-muted-foreground mt-1">
                    Ordem de execução dos projetos ativos, com prazo e contagem regressiva.
                </p>
            </div>
            <ProjectPriorities />
        </div>
    );
}
