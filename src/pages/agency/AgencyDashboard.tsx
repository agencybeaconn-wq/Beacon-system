import { useDashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, ArrowRight, CheckCircle2, Calendar, PlusCircle, Wrench, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { usePermissions } from "@/contexts/PermissionsContext";

// ... imports
export default function AgencyDashboard() {
    const { clientData } = useDashboard();
    const { linkedClientName } = usePermissions(); // Removed isClient check

    const companyName = linkedClientName || clientData?.name || "Minha Agência";
    const displayName = linkedClientName || clientData?.name || "Colaborador";

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Hero Section */}
            <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest">
                    <Sparkles className="w-3 h-3" />
                    BEM-VINDO AO BEACON SYSTEM
                </div>
                <h1 className="text-5xl font-black tracking-tight leading-tight">
                    Olá, <span className="text-primary">{displayName}</span>. 👋
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
                    Painel administrativo para gestão de demandas e clientes.
                </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="group border-border/40 hover:border-primary/40 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer bg-card overflow-hidden">
                    <Link to="/agency/new-demand">
                        <CardHeader className="pb-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <PlusCircle className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold">Nova Demanda</CardTitle>
                            <CardDescription className="text-base">Atribuir nova tarefa para um cliente.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-primary font-bold gap-2 group-hover:gap-4 transition-all uppercase text-xs tracking-widest">
                                Criar tarefa <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Link>
                </Card>

                <Card className="group border-border/40 hover:border-primary/40 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer bg-card overflow-hidden">
                    <Link to="/agency/general-board">
                        <CardHeader className="pb-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold">Quadro Geral</CardTitle>
                            <CardDescription className="text-base">Visão completa de todas as demandas.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-blue-500 font-bold gap-2 group-hover:gap-4 transition-all uppercase text-xs tracking-widest">
                                Ver quadro <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Link>
                </Card>

                <Card className="group border-border/40 hover:border-primary/40 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer bg-card overflow-hidden">
                    <Link to="/agency/my-tasks">
                        <CardHeader className="pb-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold">Minhas Tarefas</CardTitle>
                            <CardDescription className="text-base">Tarefas atribuídas especificamente a você.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-amber-500 font-bold gap-2 group-hover:gap-4 transition-all uppercase text-xs tracking-widest">
                                Gerenciar <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Link>
                </Card>

                <Card className="group border-border/40 hover:border-primary/40 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer bg-card overflow-hidden">
                    <Link to="/agency/resources">
                        <CardHeader className="pb-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Wrench className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold">Ferramentas</CardTitle>
                            <CardDescription className="text-base">Acesse recursos internos e planilhas.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-emerald-500 font-bold gap-2 group-hover:gap-4 transition-all uppercase text-xs tracking-widest">
                                Abrir ferramentas <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Link>
                </Card>
            </div>
            {/* Footer info ... */}

            {/* Portal Info Alert */}
            <div className="p-8 rounded-3xl bg-muted/30 border border-dashed border-border/60 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 space-y-2 text-center md:text-left">
                    <h3 className="text-xl font-bold">Resumo do Projeto: {companyName}</h3>
                    <p className="text-muted-foreground">O Portal do Cliente é a sua linha direta conosco. Use este espaço para centralizar toda a comunicação estratégica.</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tighter opacity-40">Seguro</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                            <Clock className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tighter opacity-40">Sync Realtime</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
