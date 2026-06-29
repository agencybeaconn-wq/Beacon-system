import { ClientRankingView } from "@/components/financial/ClientRankingModal";

export default function RankingClientes() {
    return (
        <div className="p-6 h-[calc(100vh-4rem)] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ClientRankingView embedded active />
        </div>
    );
}
