import { useState } from "react";
import { useSelectedClient, useDashboard } from "@/contexts/DashboardContext";
import { useTasks } from "@/contexts/TasksContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, ClipboardList, Send, Sparkles } from "lucide-react";
import { useAccountType } from "@/contexts/AccountTypeContext";

const AREA_OPTIONS = [
    { value: "traffic", label: "Tráfego" },
    { value: "design", label: "Design" },
    { value: "copy", label: "Copy" },
    { value: "strategy", label: "Estratégia" },
    { value: "dev", label: "Desenvolvimento" },
];

export function ClientFormsView() {
    const { selectedClientId, clientData } = useSelectedClient();
    const { isAgency } = useAccountType();

    const [title, setTitle] = useState("");
    const [area, setArea] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const clientName = clientData?.name || "Cliente";
    const clientLogoUrl = (clientData as any)?.logo_url;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !area || !description.trim()) {
            toast.error("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        setIsSubmitting(true);

        try {
            // Criar a nova tarefa seguindo a estrutura do TasksContext/lever-os
            const newTask = {
                id: `t${Date.now()}`,
                clientId: selectedClientId!,
                title: `[FORM] ${title}`,
                description,
                area,
                status: "todo",
                priority: "medium", // Default
                createdAt: new Date().toISOString(),
                // Simplificado para o exemplo, em produção isso dispararia uma mutation pro Supabase
            };

            // Simular delay de envio
            await new Promise(resolve => setTimeout(resolve, 1000));

            // No mundo real, isso seria um insert no banco e invalidação de queries
            // Aqui estamos apenas simulando o sucesso e limpando o formulário
            console.log("Demanda enviada via formulário:", newTask);

            toast.success("Demanda enviada com sucesso!", {
                description: "Sua solicitação foi registrada e nossa equipe já foi notificada."
            });

            // Reset
            setTitle("");
            setArea("");
            setDescription("");
        } catch (error) {
            console.error("Erro ao enviar formulário:", error);
            toast.error("Erro ao enviar demanda. Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* Left Column: Context & Info */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="space-y-4">
                        <h1 className="text-4xl font-black tracking-tight italic">
                            Solicitar Demanda
                        </h1>
                        <p className="text-muted-foreground text-lg leading-relaxed">
                            Preencha o formulário para enviar uma nova solicitação diretamente ao seu squad.
                        </p>
                    </div>

                    <div className="bg-muted/30 rounded-2xl p-6 border border-border/50 space-y-4">
                        <div className="flex items-center gap-4">
                            {clientLogoUrl ? (
                                <Avatar className="h-12 w-12 border-2 border-background shadow-md">
                                    <AvatarImage src={clientLogoUrl} alt={clientName} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                        {clientName.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            ) : (
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary border-2 border-background shadow-md">
                                    <Sparkles className="w-6 h-6" />
                                </div>
                            )}
                            <div>
                                <h3 className="font-bold text-foreground">Squad {clientName}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-xs text-muted-foreground font-medium">Equipe Disponível</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-px w-full bg-border/50" />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Todas as demandas passam por uma triagem inicial e são priorizadas de acordo com a disponibilidade do time.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 text-muted-foreground pt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <span className="text-xs font-medium italic">Powered by Beacon System AI</span>
                        </div>
                        <span className="text-xs pl-3.5">Seguro e Protegido</span>
                    </div>
                </div>

                {/* Right Column: The Form */}
                <div className="lg:col-span-8">
                    <Card className="border-border shadow-2xl overflow-hidden bg-background/50 backdrop-blur-sm">
                        <div className="h-1.5 w-full bg-gradient-to-r from-primary to-primary/60" />
                        <CardHeader className="bg-muted/30 border-b border-border/50 py-6 px-8">
                            <div>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <ClipboardList className="w-5 h-5 text-primary" />
                                    Detalhes da Solicitação
                                </CardTitle>
                                <CardDescription className="text-sm">
                                    Descreva o que você precisa com clareza.
                                </CardDescription>
                            </div>
                        </CardHeader>

                        <form onSubmit={handleSubmit}>
                            <CardContent className="space-y-8 p-8">
                                {/* Título e Área (Grid Row) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Título da Demanda */}
                                    <div className="space-y-3">
                                        <Label htmlFor="title" className="text-base font-bold flex items-center gap-2">
                                            Título da Demanda
                                            <span className="text-red-500 font-bold">*</span>
                                        </Label>
                                        <Input
                                            id="title"
                                            placeholder="Ex: Alteração de preço..."
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            className="h-12 text-base border-border/60 focus:ring-primary/20 bg-background"
                                            required
                                        />
                                        <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider opacity-70">Identificação</p>
                                    </div>

                                    {/* Área Responsável */}
                                    <div className="space-y-3">
                                        <Label htmlFor="area" className="text-base font-bold flex items-center gap-2">
                                            Área Responsável
                                            <span className="text-red-500 font-bold">*</span>
                                        </Label>
                                        <Select value={area} onValueChange={setArea} required>
                                            <SelectTrigger className="h-12 text-base border-border/60 bg-background">
                                                <SelectValue placeholder="Selecionar..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {AREA_OPTIONS.map(opt => (
                                                    <SelectItem key={opt.value} value={opt.value} className="text-base py-3">
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider opacity-70">Atribuição</p>
                                    </div>
                                </div>

                                {/* Descrição Detalhada */}
                                <div className="space-y-3">
                                    <Label htmlFor="description" className="text-base font-bold flex items-center gap-2">
                                        Descrição detalhada
                                        <span className="text-red-500 font-bold">*</span>
                                    </Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Explique o que precisa ser feito com o máximo de detalhes possível..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="min-h-[200px] text-base border-border/60 bg-background resize-none p-4 leading-relaxed"
                                        required
                                    />
                                    <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider opacity-70">Conteúdo</p>
                                </div>
                            </CardContent>

                            <CardFooter className="bg-muted/20 border-t border-border/50 p-6 flex justify-end">
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="h-12 px-8 text-base font-bold gap-2 shadow-lg hover:shadow-primary/20 transition-all rounded-lg"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Enviar Demanda
                                        </>
                                    )}
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                </div>
            </div>
        </div>
    );
}
