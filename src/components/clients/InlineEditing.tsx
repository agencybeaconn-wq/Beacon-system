import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, Pencil, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

import { useDashboard } from "@/contexts/DashboardContext";

interface InlineEditableNameProps {
    clientId: string;
    initialName: string;
    onNameChange?: (newName: string) => void;
    className?: string;
}

export function InlineEditableName({ clientId, initialName, onNameChange, className }: InlineEditableNameProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(initialName);
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { refreshClients } = useDashboard();

    useEffect(() => {
        setName(initialName);
    }, [initialName]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = async () => {
        if (name.trim() === "" || name === initialName) {
            setName(initialName);
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await (supabase as any)
                .from('agency_clients')
                .update({ name: name.trim() })
                .eq('id', clientId);

            if (error) throw error;

            toast({
                title: "Nome atualizado!",
                description: `O cliente agora se chama "${name.trim()}".`,
            });


            onNameChange?.(name.trim());
            setIsEditing(false);

            // Sync with global context (Sidebar, Selector, etc)
            refreshClients();
        } catch (error: any) {
            console.error("Erro ao atualizar nome:", error);
            toast({
                variant: "destructive",
                title: "Erro ao salvar",
                description: error.message || "Não foi possível atualizar o nome.",
            });
            setName(initialName);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setName(initialName);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSave();
        } else if (e.key === "Escape") {
            handleCancel();
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2">
                <Input
                    ref={inputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSaving}
                    className="text-2xl lg:text-3xl font-bold h-auto py-1 px-2"
                />
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                >
                    <Check className="w-4 h-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 group">
            <h1 className={cn("text-2xl lg:text-3xl font-bold tracking-tight", className)}>
                {name}
            </h1>
            <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsEditing(true)}
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10"
            >
                <Pencil className="w-4 h-4 text-muted-foreground" />
            </Button>
        </div>
    );
}

interface EditableAvatarProps {
    clientId: string;
    clientName: string;
    currentLogoUrl?: string | null;
    primaryColor: string;
    onAvatarChange?: (newUrl: string) => void;
}

export function EditableAvatar({ clientId, clientName, currentLogoUrl, primaryColor, onAvatarChange }: EditableAvatarProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [logoUrl, setLogoUrl] = useState(currentLogoUrl);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { refreshClients } = useDashboard();

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast({
                variant: "destructive",
                title: "Arquivo inválido",
                description: "Por favor, selecione uma imagem.",
            });
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast({
                variant: "destructive",
                title: "Arquivo muito grande",
                description: "A imagem deve ter no máximo 2MB.",
            });
            return;
        }

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `client-logos/${clientId}-${Date.now()}.${fileExt}`;

            // Upload to Supabase Storage (using existing 'avatars' bucket)
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            // Update client record with logo URL
            const { error: updateError } = await (supabase as any)
                .from('agency_clients')
                .update({ logo_url: publicUrl })
                .eq('id', clientId);

            if (updateError) throw updateError;

            setLogoUrl(publicUrl);
            onAvatarChange?.(publicUrl);

            // Sync with global context
            refreshClients();

            toast({
                title: "Logo atualizado!",
                description: "A imagem do cliente foi atualizada.",
            });
        } catch (error: any) {
            console.error("Erro ao fazer upload:", error);
            toast({
                variant: "destructive",
                title: "Erro ao fazer upload",
                description: error.message || "Não foi possível atualizar a imagem.",
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="relative group">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            {logoUrl ? (
                <img
                    src={logoUrl}
                    alt={clientName}
                    className="w-16 h-16 lg:w-20 lg:h-20 rounded-none object-cover"
                />
            ) : (
                <div
                    className="w-16 h-16 lg:w-20 lg:h-20 rounded-none flex items-center justify-center text-2xl lg:text-3xl font-bold text-primary-foreground bg-primary"
                >
                    {clientName.substring(0, 2).toUpperCase()}
                </div>
            )}

            {/* Edit Overlay */}
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={cn(
                    "absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer",
                    isUploading && "opacity-100"
                )}
            >
                {isUploading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    <Camera className="w-6 h-6 text-white" />
                )}
            </button>
        </div>
    );
}

interface InlineEditableValueProps {
    clientId: string;
    fieldName: 'fee_fixed' | 'commission_rate' | 'payment_due_day'; // Added payment_due_day support
    initialValue: number;
    type: 'currency' | 'percentage' | 'number';
    onValueChange?: (newValue: number) => void;
    className?: string;
}

export function InlineEditableValue({
    clientId,
    fieldName,
    initialValue,
    type,
    onValueChange,
    className
}: InlineEditableValueProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(initialValue);
    const [inputValue, setInputValue] = useState(
        type === 'currency'
            ? initialValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
            : initialValue.toString()
    );
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { refreshClients } = useDashboard();

    useEffect(() => {
        setValue(initialValue);
        setInputValue(
            type === 'currency'
                ? initialValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                : initialValue.toString()
        );
    }, [initialValue, type]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const parseValue = (str: string): number => {
        if (type === 'currency') {
            return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
        }
        return parseFloat(str) || 0;
    };

    const handleSave = async () => {
        const numValue = parseValue(inputValue);

        if (numValue === initialValue) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await (supabase as any)
                .from('agency_clients')
                .update({ [fieldName]: numValue })
                .eq('id', clientId);

            if (error) throw error;

            // Optional: If we are updating payment_due_day, also update existing pending invoices for this client
            if (fieldName === 'payment_due_day') {
                const monthRef = format(new Date(), 'yyyy-MM');
                const newDueDate = format(new Date(new Date().getFullYear(), new Date().getMonth(), numValue), 'yyyy-MM-dd');

                await (supabase as any)
                    .from('client_invoices')
                    .update({ due_date: newDueDate })
                    .eq('client_id', clientId)
                    .eq('month_reference', monthRef)
                    .eq('status', 'pending');
            }

            setValue(numValue);
            // Also update the display value
            setInputValue(
                type === 'currency'
                    ? numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    : numValue.toString()
            );
            onValueChange?.(numValue);
            setIsEditing(false);

            // Sync with global context
            refreshClients();

            toast({
                title: "Valor atualizado!",
                description: fieldName === 'payment_due_day'
                    ? `Novo dia de vencimento: ${numValue}`
                    : type === 'currency'
                        ? `Novo valor: R$ ${numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : `Nova comissão: ${numValue}%`,
            });
        } catch (error: any) {
            console.error("Erro ao atualizar valor:", error);
            toast({
                variant: "destructive",
                title: "Erro ao salvar",
                description: error.message || "Não foi possível atualizar o valor.",
            });
            setInputValue(
                type === 'currency'
                    ? initialValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    : initialValue.toString()
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setInputValue(
            type === 'currency'
                ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                : value.toString()
        );
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSave();
        } else if (e.key === "Escape") {
            handleCancel();
        }
    };

    const handleCurrencyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (type === 'currency') {
            let val = e.target.value.replace(/\D/g, "");
            const result = (Number(val) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
            setInputValue(result);
        } else {
            setInputValue(e.target.value);
        }
    };

    const formattedDisplay = type === 'currency'
        ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : type === 'percentage'
            ? `${value}%`
            : value.toString();

    if (isEditing) {
        return (
            <div className="flex items-center gap-2">
                <div className="relative">
                    {type === 'currency' && (
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    )}
                    <Input
                        ref={inputRef}
                        value={inputValue}
                        onChange={handleCurrencyInput}
                        onKeyDown={handleKeyDown}
                        disabled={isSaving}
                        className={cn(
                            "text-xl font-bold h-10 w-32",
                            type === 'currency' ? "pl-8" : "pr-6"
                        )}
                    />
                    {type === 'percentage' && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    )}
                </div>
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                >
                    <Check className="w-4 h-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 group/edit">
            <span className={cn("text-2xl lg:text-3xl font-bold", className)}>
                {formattedDisplay}
            </span>
            <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsEditing(true)}
                className="h-7 w-7 opacity-0 group-hover/edit:opacity-100 transition-opacity hover:bg-primary/10"
            >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
        </div>
    );
}

