import { useDashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, ArrowRight, CheckCircle2, Clock, PlusCircle, Calendar, BarChart3, Film } from "lucide-react";
import { Link } from "react-router-dom";
import { usePermissions } from "@/contexts/PermissionsContext";

export default function PortalDashboard() {
    const { clientData } = useDashboard();
    const { linkedClientName, isClient } = usePermissions();

    const companyName = linkedClientName || clientData?.name || "Minha Loja";
    const displayName = linkedClientName || clientData?.name || "Parceiro";

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Hero Section */}
            <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest">
                    <Sparkles className="w-3 h-3" />
                    BEM-VINDO AO BEACON PORTAL
                </div>
                <h1 className="text-5xl font-black tracking-tight leading-tight">
                    Olá, <span className="text-primary">{displayName}</span>. 👋
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
                    Aqui você pode solicitar novas demandas, acompanhar o progresso das tarefas e gerenciar o crescimento da sua marca junto com nosso squad.
                </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="group border-border/40 hover:border-primary/40 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer bg-card overflow-hidden">
                    <Link to="/portal/new-demand">
                        <CardHeader className="pb-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <PlusCircle className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold">Nova Solicitação</CardTitle>
                            <CardDescription className="text-base">Precisa de algo novo? Clique aqui para preencher o formulário.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-primary font-bold gap-2 group-hover:gap-4 transition-all uppercase text-xs tracking-widest">
                                Solicitar agora <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Link>
                </Card>

                <Card className="group border-border/40 hover:border-primary/40 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer bg-card overflow-hidden">
                    <Link to="/portal/visao-geral">
                        <CardHeader className="pb-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <BarChart3 className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold">Visão Geral</CardTitle>
                            <CardDescription className="text-base">Acompanhe o desempenho das suas campanhas em tempo real.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-indigo-500 font-bold gap-2 group-hover:gap-4 transition-all uppercase text-xs tracking-widest">
                                Ver dashboard <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Link>
                </Card>

                <Card className="group border-border/40 hover:border-primary/40 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer bg-card overflow-hidden">
                    <Link to="/portal/tasks">
                        <CardHeader className="pb-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold">Demandas</CardTitle>
                            <CardDescription className="text-base">Veja o que estamos fazendo agora e o que já foi entregue.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-blue-500 font-bold gap-2 group-hover:gap-4 transition-all uppercase text-xs tracking-widest">
                                Ver cronograma <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Link>
                </Card>

                <Card className="group border-border/40 hover:border-primary/40 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer bg-card overflow-hidden">
                    <Link to="/portal/my-tasks">
                        <CardHeader className="pb-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold">Minhas Tarefas</CardTitle>
                            <CardDescription className="text-base">Suas pendências e aprovações que precisam de atenção.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-amber-500 font-bold gap-2 group-hover:gap-4 transition-all uppercase text-xs tracking-widest">
                                Gerenciar tarefas <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Link>
                </Card>

                <Card className="group border-border/40 hover:border-primary/40 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer bg-card overflow-hidden">
                    <Link to="/portal/resources">
                        <CardHeader className="pb-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold">Ferramentas</CardTitle>
                            <CardDescription className="text-base">Acesse suas planilhas, agentes de IA e recursos da agência.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-purple-500 font-bold gap-2 group-hover:gap-4 transition-all uppercase text-xs tracking-widest">
                                Abrir ferramentas <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Link>
                </Card>

                <Card className="group border-border/40 hover:border-primary/40 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer bg-card overflow-hidden">
                    <Link to="/portal/biblioteca">
                        <CardHeader className="pb-4">
                            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Film className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold">Biblioteca</CardTitle>
                            <CardDescription className="text-base">Acesse nossos conteúdos, treinamentos e tutoriais exclusivos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-rose-500 font-bold gap-2 group-hover:gap-4 transition-all uppercase text-xs tracking-widest">
                                Acessar conteúdos <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Link>
                </Card>
            </div>

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
        </div >
    );
}
