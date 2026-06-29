import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, User, Phone, Mail, Edit2, Check, X, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAvatar } from "@/lib/uploadAvatar";

interface AccountDetailsProps {
    collapsed?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function AccountDetailsPopover({ collapsed, onOpenChange }: AccountDetailsProps) {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form states
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");

    useEffect(() => {
        if (isOpen && user) {
            setFullName(user.user_metadata?.full_name || "");
            setPhone(user.user_metadata?.phone || "");
        }
    }, [isOpen, user?.id, user?.user_metadata]); // Refresh when opened or user changes

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (onOpenChange) onOpenChange(open);
    };

    const handleLogout = async () => {
        const isAcademy = typeof window !== 'undefined' && window.location.pathname.startsWith('/academy');
        await supabase.auth.signOut();
        window.location.href = isAcademy ? '/academy/login' : '/login';
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                data: {
                    full_name: fullName,
                    phone: phone
                }
            });

            if (error) throw error;

            toast.success("Perfil atualizado com sucesso!");
            setIsEditing(false);
        } catch (error: any) {
            toast.error("Erro ao atualizar perfil: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && user) {
            setLoading(true);
            const result = await uploadAvatar(file, user.id);
            setLoading(false);
            if (result.success && result.url) {
                toast.success('Foto atualizada com sucesso!');
            } else {
                toast.error(result.error || 'Erro ao enviar foto.');
            }
        }
    };

    if (collapsed) {
        return (
            <Popover onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                        <User className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent side="right" className="w-80 p-0" align="end">
                    <AccountCard
                        user={user}
                        isEditing={isEditing}
                        setIsEditing={setIsEditing}
                        fullName={fullName}
                        setFullName={setFullName}
                        phone={phone}
                        setPhone={setPhone}
                        handleSave={handleSave}
                        handleLogout={handleLogout}
                        handleAvatarChange={handleAvatarChange}
                        loading={loading}
                    />
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2 px-2 h-auto py-2 hover:bg-sidebar-accent">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.user_metadata?.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                            {user?.email?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start text-sm overflow-hidden">
                        <span className="font-medium truncate w-full text-left">
                            {user?.user_metadata?.full_name || "Usuário"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate w-full text-left">
                            {user?.email}
                        </span>
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0 mb-2" align="start" side="top">
                <AccountCard
                    user={user}
                    isEditing={isEditing}
                    setIsEditing={setIsEditing}
                    fullName={fullName}
                    setFullName={setFullName}
                    phone={phone}
                    setPhone={setPhone}
                    handleSave={handleSave}
                    handleLogout={handleLogout}
                    handleAvatarChange={handleAvatarChange}
                    loading={loading}
                />
            </PopoverContent>
        </Popover>
    );
}

// Inner Component for the Card Content
function AccountCard({
    user, isEditing, setIsEditing,
    fullName, setFullName, phone, setPhone,
    handleSave, handleLogout, handleAvatarChange, loading
}: any) {
    return (
        <div className="flex flex-col">
            {/* Header */}
            <div className="p-4 bg-muted/30 border-b flex items-center gap-3">
                <div className="relative group rounded-full">
                    <Avatar className={`h-12 w-12 border-2 border-background shadow-sm ${isEditing && loading ? 'opacity-50' : ''}`}>
                        <AvatarImage src={user?.user_metadata?.avatar_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                            {user?.email?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    {isEditing && (
                        <Label
                            htmlFor="avatar-upload"
                            className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-all font-bold backdrop-blur-[1px]"
                        >
                            <Edit2 className="h-4 w-4 text-white" />
                        </Label>
                    )}
                </div>
                {isEditing && (
                    <Input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        disabled={loading}
                        className="hidden"
                    />
                )}

                <div className="flex flex-col overflow-hidden">
                    <span className="font-semibold text-lg truncate">
                        {user?.user_metadata?.full_name || "Sem nome"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {user?.email}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                            Dados Pessoais
                        </h4>
                        {!isEditing ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs gap-1 text-primary hover:text-primary/80 px-2"
                                onClick={() => setIsEditing(true)}
                            >
                                <Edit2 className="h-3 w-3" /> Editar
                            </Button>
                        ) : (
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                                    onClick={() => setIsEditing(false)}
                                    disabled={loading}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-6 text-xs gap-1 px-2"
                                    onClick={handleSave}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    Salvar
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="name" className="text-xs">Nome Completo</Label>
                            {isEditing ? (
                                <Input
                                    id="name"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="Seu nome"
                                />
                            ) : (
                                <div className="flex items-center gap-2 text-sm border p-2 rounded-md bg-muted/10">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span>{user?.user_metadata?.full_name || "Não informado"}</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="phone" className="text-xs">Telefone / WhatsApp</Label>
                            {isEditing ? (
                                <Input
                                    id="phone"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="+55 11 99999-9999"
                                />
                            ) : (
                                <div className="flex items-center gap-2 text-sm border p-2 rounded-md bg-muted/10">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span>{user?.user_metadata?.phone || "Não informado"}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-2 border-t mt-auto bg-muted/10">
                <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 font-normal"
                    onClick={handleLogout}
                >
                    <LogOut className="h-4 w-4" /> Desconectar Conta
                </Button>
            </div>
        </div>
    );
}
