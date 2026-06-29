import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    KeyRound,
    Plus,
    Eye,
    EyeOff,
    Pencil,
    Trash2,
    Copy,
    ExternalLink,
    Loader2,
    Mail,
    Share2,
    BarChart3,
    Shield,
    Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CredentialRow {
    id: string;
    client_id: string;
    label: string;
    category: string;
    username: string | null;
    url: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

interface ClientCredentialsSectionProps {
    clientId: string;
}

const CATEGORIES = [
    { value: "email", label: "E-mail", icon: Mail },
    { value: "social", label: "Redes Sociais", icon: Share2 },
    { value: "analytics", label: "Analytics", icon: BarChart3 },
    { value: "admin", label: "Administrativo", icon: Shield },
    { value: "other", label: "Outro", icon: Lock },
];

function categoryIcon(cat: string) {
    return CATEGORIES.find(c => c.value === cat)?.icon || Lock;
}

function categoryLabel(cat: string) {
    return CATEGORIES.find(c => c.value === cat)?.label || "Outro";
}

export function ClientCredentialsSection({ clientId }: ClientCredentialsSectionProps) {
    const [credentials, setCredentials] = useState<CredentialRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
    const [revealingId, setRevealingId] = useState<string | null>(null);
    const { toast } = useToast();

    // Form state
    const [formLabel, setFormLabel] = useState("");
    const [formCategory, setFormCategory] = useState("other");
    const [formUsername, setFormUsername] = useState("");
    const [formPassword, setFormPassword] = useState("");
    const [formUrl, setFormUrl] = useState("");
    const [formNotes, setFormNotes] = useState("");
    const [formSaving, setFormSaving] = useState(false);
    const [formShowPassword, setFormShowPassword] = useState(false);

    // ─── Fetch list ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!clientId) return;
        loadCredentials();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId]);

    async function loadCredentials() {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke('client-credentials', {
            body: { action: 'list', client_id: clientId },
        });
        setLoading(false);
        if (error) {
            toast({ title: "Erro ao carregar credenciais", description: error.message, variant: "destructive" });
            return;
        }
        setCredentials(data?.data || []);
    }

    // ─── Reveal password ───────────────────────────────────────────────
    async function revealPassword(id: string) {
        if (revealedPasswords[id] !== undefined) {
            // Já revelado — esconde
            const next = { ...revealedPasswords };
            delete next[id];
            setRevealedPasswords(next);
            return;
        }
        setRevealingId(id);
        const { data, error } = await supabase.functions.invoke('client-credentials', {
            body: { action: 'get', id },
        });
        setRevealingId(null);
        if (error) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
            return;
        }
        setRevealedPasswords({ ...revealedPasswords, [id]: data?.data?.password || "" });
    }

    async function copyPassword(id: string) {
        if (revealedPasswords[id]) {
            await navigator.clipboard.writeText(revealedPasswords[id]);
            toast({ title: "Senha copiada" });
            return;
        }
        // Fetch + copy direto
        const { data, error } = await supabase.functions.invoke('client-credentials', {
            body: { action: 'get', id },
        });
        if (error) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
            return;
        }
        await navigator.clipboard.writeText(data?.data?.password || "");
        toast({ title: "Senha copiada" });
    }

    // ─── Open form pra criar ou editar ─────────────────────────────────
    function openCreate() {
        setEditingId(null);
        setFormLabel("");
        setFormCategory("other");
        setFormUsername("");
        setFormPassword("");
        setFormUrl("");
        setFormNotes("");
        setFormShowPassword(false);
        setIsModalOpen(true);
    }

    async function openEdit(c: CredentialRow) {
        setEditingId(c.id);
        setFormLabel(c.label);
        setFormCategory(c.category);
        setFormUsername(c.username || "");
        setFormUrl(c.url || "");
        setFormNotes(c.notes || "");
        setFormShowPassword(false);
        setIsModalOpen(true);
        // Busca a senha pra preencher
        const { data, error } = await supabase.functions.invoke('client-credentials', {
            body: { action: 'get', id: c.id },
        });
        if (error) {
            toast({ title: "Erro ao carregar senha", description: error.message, variant: "destructive" });
            setFormPassword("");
            return;
        }
        setFormPassword(data?.data?.password || "");
    }

    // ─── Save ──────────────────────────────────────────────────────────
    async function handleSave() {
        if (!formLabel.trim()) {
            toast({ title: "Campo obrigatório", description: "Preencha o label.", variant: "destructive" });
            return;
        }
        setFormSaving(true);
        const payload: Record<string, unknown> = {
            action: 'upsert',
            label: formLabel.trim(),
            category: formCategory,
            username: formUsername.trim() || null,
            password: formPassword || null,
            url: formUrl.trim() || null,
            notes: formNotes.trim() || null,
        };
        if (editingId) payload.id = editingId;
        else payload.client_id = clientId;

        const { error } = await supabase.functions.invoke('client-credentials', { body: payload });
        setFormSaving(false);
        if (error) {
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
            return;
        }
        toast({ title: editingId ? "Credencial atualizada" : "Credencial adicionada" });
        setIsModalOpen(false);
        loadCredentials();
    }

    // ─── Delete ────────────────────────────────────────────────────────
    async function handleDelete() {
        if (!deleteId) return;
        const { error } = await supabase.functions.invoke('client-credentials', {
            body: { action: 'delete', id: deleteId },
        });
        if (error) {
            toast({ title: "Erro ao deletar", description: error.message, variant: "destructive" });
            return;
        }
        toast({ title: "Credencial removida" });
        setDeleteId(null);
        loadCredentials();
    }

    // ─── Render ────────────────────────────────────────────────────────
    return (
        <>
            <Card className="overflow-hidden border-border/40 bg-card text-card-foreground shadow-none">
                <CardHeader className="border-b border-border/40 bg-muted/30 pb-6">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <CardTitle className="text-xl flex items-center gap-2 font-bold">
                                <KeyRound className="w-5 h-5 text-purple-500" />
                                Credenciais & Acessos
                            </CardTitle>
                            <CardDescription>
                                Logins e senhas do cliente — armazenados criptografados (AES-256 via pgcrypto + Vault).
                            </CardDescription>
                        </div>
                        <Button onClick={openCreate} className="gap-2 shadow-none" size="sm">
                            <Plus className="w-4 h-4" />
                            Adicionar
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Carregando...
                        </div>
                    ) : credentials.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Nenhuma credencial cadastrada.</p>
                            <p className="text-xs mt-1">Clique em "Adicionar" para começar.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {credentials.map(c => {
                                const Icon = categoryIcon(c.category);
                                const revealed = revealedPasswords[c.id] !== undefined;
                                return (
                                    <div
                                        key={c.id}
                                        className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="w-9 h-9 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                                            <Icon className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-sm truncate">{c.label}</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {categoryLabel(c.category)}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                                {c.username && <span className="truncate">{c.username}</span>}
                                                {c.url && (
                                                    <a
                                                        href={c.url.startsWith('http') ? c.url : `https://${c.url}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="hover:text-foreground inline-flex items-center gap-1"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                            {revealed && (
                                                <div className="mt-1 text-xs font-mono bg-muted/50 px-2 py-1 rounded inline-block">
                                                    {revealedPasswords[c.id] || "(senha vazia)"}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => revealPassword(c.id)}
                                                disabled={revealingId === c.id}
                                                title={revealed ? "Ocultar" : "Ver senha"}
                                            >
                                                {revealingId === c.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : revealed ? (
                                                    <EyeOff className="w-4 h-4" />
                                                ) : (
                                                    <Eye className="w-4 h-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copyPassword(c.id)}
                                                title="Copiar senha"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEdit(c)}
                                                title="Editar"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDeleteId(c.id)}
                                                title="Remover"
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal de criar / editar */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Editar credencial" : "Nova credencial"}</DialogTitle>
                        <DialogDescription>
                            Senha é criptografada antes de salvar no banco. Ninguém com acesso direto à DB consegue lê-la.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="cred-label">Label *</Label>
                            <Input
                                id="cred-label"
                                value={formLabel}
                                onChange={e => setFormLabel(e.target.value)}
                                placeholder="Ex: Gmail Pessoal"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cred-category">Categoria</Label>
                            <Select value={formCategory} onValueChange={setFormCategory}>
                                <SelectTrigger id="cred-category">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(c => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cred-username">Usuário / E-mail</Label>
                            <Input
                                id="cred-username"
                                value={formUsername}
                                onChange={e => setFormUsername(e.target.value)}
                                placeholder="cliente@gmail.com"
                                autoComplete="off"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cred-password">Senha</Label>
                            <div className="relative">
                                <Input
                                    id="cred-password"
                                    type={formShowPassword ? "text" : "password"}
                                    value={formPassword}
                                    onChange={e => setFormPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="off"
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setFormShowPassword(!formShowPassword)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {formShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cred-url">URL (opcional)</Label>
                            <Input
                                id="cred-url"
                                value={formUrl}
                                onChange={e => setFormUrl(e.target.value)}
                                placeholder="https://accounts.google.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cred-notes">Notas (opcional)</Label>
                            <Textarea
                                id="cred-notes"
                                value={formNotes}
                                onChange={e => setFormNotes(e.target.value)}
                                placeholder="Notas adicionais (não são criptografadas)"
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={formSaving}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={formSaving} className="gap-2">
                            {formSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {editingId ? "Salvar alterações" : "Adicionar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmar delete */}
            <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover credencial?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A credencial será removida permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                            Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
