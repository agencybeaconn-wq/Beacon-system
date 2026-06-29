import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, X, Star, Package, ShoppingBag, Code, Palette, Zap, Globe, ImageIcon, Workflow, Calendar, TrendingUp, Edit, Trash2, LayoutDashboard, Database, Repeat, HeartHandshake, Check } from "lucide-react";
import { useAgencyProducts, ICON_OPTIONS, COLOR_OPTIONS, AgencyProduct } from "@/hooks/useAgencyProducts";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    Star, Package, ShoppingBag, Code, Palette, Zap, Globe, ImageIcon, Workflow, Calendar, TrendingUp,
    LayoutDashboard, Database, Repeat, HeartHandshake, Check
};

const DEFAULT_PILLARS = [
    { id: "Estratégico", label: "Estratégico", icon: "LayoutDashboard", color: "text-purple-500" },
    { id: "Ativos Shopify", label: "Ativos Shopify", icon: "Database", color: "text-blue-500" },
    { id: "Operacional Mensal", label: "Operacional Mensal", icon: "Repeat", color: "text-emerald-500" },
    { id: "Automações & Retenção", label: "Automações & Retenção", icon: "Zap", color: "text-yellow-500" },
    { id: "Suporte", label: "Suporte", icon: "HeartHandshake", color: "text-pink-500" },
    { id: "Geral", label: "Geral / Outros", icon: "Check", color: "text-gray-500" },
];

interface ProductFormModalProps {
    trigger?: React.ReactNode;
    product?: AgencyProduct; // If provided, we are in edit mode
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function ProductFormModal({ trigger, product, open: controlledOpen, onOpenChange }: ProductFormModalProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setIsOpen = onOpenChange || setInternalOpen;

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState<"flagship" | "fixed" | "avulso">("fixed");
    const [pricingType, setPricingType] = useState<"fixed" | "percentage" | "unique">("fixed");
    const [price, setPrice] = useState("");
    const [iconName, setIconName] = useState("Package");
    const [color, setColor] = useState("#7C3AED");
    const [features, setFeatures] = useState<string[]>([""]);
    const [groups, setGroups] = useState<{ id: string; label: string; icon?: string; color?: string }[]>(DEFAULT_PILLARS);

    // Group editing state
    const [newGroupLabel, setNewGroupLabel] = useState("");
    const [newGroupColor, setNewGroupColor] = useState("text-gray-500");

    const { createProduct, updateProduct } = useAgencyProducts();
    const isEditing = !!product;

    useEffect(() => {
        if (isOpen && product) {
            setName(product.name);
            setDescription(product.description || "");
            setCategory(product.category);
            setPricingType(product.pricing_type);
            setPrice(product.price || "");
            setIconName(product.icon_name);
            setColor(product.color);
            setFeatures(product.features?.map(f => f.name) || [""]);
            setGroups(product.groups || DEFAULT_PILLARS);
        } else if (isOpen && !product) {
            // Reset for create mode
            setName("");
            setDescription("");
            setCategory("fixed");
            setPricingType("fixed");
            setPrice("");
            setIconName("Package");
            setColor("#7C3AED");
            setFeatures([""]);
            setGroups(DEFAULT_PILLARS);
        }
    }, [isOpen, product]);

    const handleAddFeature = () => {
        setFeatures([...features, ""]);
    };

    const handleRemoveFeature = (index: number) => {
        setFeatures(features.filter((_, i) => i !== index));
    };

    const handleFeatureChange = (index: number, value: string) => {
        const newFeatures = [...features];
        newFeatures[index] = value;
        setFeatures(newFeatures);
    };

    const handleAddGroup = () => {
        if (!newGroupLabel.trim()) return;
        const id = newGroupLabel.trim(); // Simple ID generation
        setGroups([...groups, {
            id,
            label: newGroupLabel.trim(),
            icon: "Check",
            color: newGroupColor
        }]);
        setNewGroupLabel("");
    };

    const handleRemoveGroup = (groupId: string) => {
        setGroups(groups.filter(g => g.id !== groupId));
    };

    const handleSubmit = async () => {
        if (!name.trim()) return;

        const validFeatures = features.filter(f => f.trim() !== "");

        try {
            if (isEditing && product) {
                await updateProduct.mutateAsync({
                    id: product.id,
                    name: name.trim(),
                    description: description.trim() || undefined,
                    category,
                    pricing_type: pricingType,
                    price: price.trim() || undefined,
                    icon_name: iconName,
                    color,
                    is_flagship: category === "flagship",
                    groups: groups
                });
                // Note: updating features via this modal in edit mode is complex because features have IDs.
                // We typically use the DetailedProductCard for feature management.
                // If we want to allow adding NEW features here, we'd need separate logic.
                // For now, let's assume this modal mainly edits PRODUCT METADATA and GROUPS in edit mode.
                // Features are better managed in the card view to preserve IDs and state.

            } else {
                await createProduct.mutateAsync({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    category,
                    pricing_type: pricingType,
                    price: price.trim() || undefined,
                    icon_name: iconName,
                    color,
                    is_flagship: category === "flagship",
                    features: validFeatures,
                    groups: groups
                });
            }

            setIsOpen(false);
        } catch (error) {
            console.error(error);
        }
    };

    const IconComponent = ICON_MAP[iconName] || Package;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="h-11 px-5 gap-2 font-bold">
                        <Plus className="w-4 h-4" strokeWidth={3} />
                        Novo Produto
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Editar Produto" : "Criar Novo Produto"}</DialogTitle>
                    <DialogDescription>
                        {isEditing ? "Edite as informações e grupos do produto." : "Preencha os dados do novo produto."}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="info" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="info">Informações Básicas</TabsTrigger>
                        <TabsTrigger value="groups">Grupos e Categorias</TabsTrigger>
                    </TabsList>

                    <div className="py-4">
                        <TabsContent value="info" className="space-y-6">
                            {/* Nome */}
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome do Produto *</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ex: Gestão de Tráfego"
                                />
                            </div>

                            {/* Descrição */}
                            <div className="space-y-2">
                                <Label htmlFor="description">Descrição</Label>
                                <Textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Breve descrição do produto..."
                                    rows={2}
                                />
                            </div>

                            {/* Categoria e Tipo de Preço */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Categoria *</Label>
                                    <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="flagship">⭐ Solução Completa</SelectItem>
                                            <SelectItem value="fixed">📅 Fixo Mensal</SelectItem>
                                            <SelectItem value="avulso">📦 Avulso</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Tipo de Preço *</Label>
                                    <Select value={pricingType} onValueChange={(v: any) => setPricingType(v)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fixed">Mensal Fixo</SelectItem>
                                            <SelectItem value="percentage">% + Fixo</SelectItem>
                                            <SelectItem value="unique">Pagamento Único</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Preço */}
                            <div className="space-y-2">
                                <Label htmlFor="price">Preço</Label>
                                <Input
                                    id="price"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="Ex: R$ 3.500/mês"
                                />
                            </div>

                            {/* Ícone e Cor */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Ícone</Label>
                                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                                        {ICON_OPTIONS.map((icon) => {
                                            const Icon = ICON_MAP[icon];
                                            return (
                                                <button
                                                    key={icon}
                                                    type="button"
                                                    onClick={() => setIconName(icon)}
                                                    className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                                                        iconName === icon
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-background border hover:border-primary/50"
                                                    )}
                                                >
                                                    <Icon className="w-5 h-5" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Cor</Label>
                                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                                        {COLOR_OPTIONS.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setColor(c)}
                                                className={cn(
                                                    "w-10 h-10 rounded-lg transition-all",
                                                    color === c && "ring-2 ring-offset-2 ring-primary"
                                                )}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {!isEditing && (
                                <div className="space-y-3 pt-4 border-t">
                                    <div className="flex items-center justify-between">
                                        <Label>Executáveis Iniciais</Label>
                                        <Button type="button" variant="ghost" size="sm" onClick={handleAddFeature}>
                                            <Plus className="w-4 h-4 mr-1" />
                                            Adicionar
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        {features.map((feature, index) => (
                                            <div key={index} className="flex gap-2">
                                                <Input
                                                    value={feature}
                                                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                                                    placeholder={`Executável ${index + 1}`}
                                                />
                                                {features.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveFeature(index)}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="groups" className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-end gap-2 p-4 bg-muted/30 rounded-lg border">
                                    <div className="space-y-2 flex-1">
                                        <Label>Novo Grupo</Label>
                                        <Input
                                            value={newGroupLabel}
                                            onChange={(e) => setNewGroupLabel(e.target.value)}
                                            placeholder="Ex: Marketing"
                                        />
                                    </div>
                                    <div className="space-y-2 w-32">
                                        <Label>Cor</Label>
                                        <Select value={newGroupColor} onValueChange={setNewGroupColor}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="text-purple-500">Roxo</SelectItem>
                                                <SelectItem value="text-blue-500">Azul</SelectItem>
                                                <SelectItem value="text-emerald-500">Verde</SelectItem>
                                                <SelectItem value="text-yellow-500">Amarelo</SelectItem>
                                                <SelectItem value="text-pink-500">Rosa</SelectItem>
                                                <SelectItem value="text-gray-500">Cinza</SelectItem>
                                                <SelectItem value="text-red-500">Vermelho</SelectItem>
                                                <SelectItem value="text-orange-500">Laranja</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={handleAddGroup} disabled={!newGroupLabel.trim()}>
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <Label>Grupos Ativos</Label>
                                    <div className="grid gap-2">
                                        {groups.map((group) => (
                                            <div key={group.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("w-3 h-3 rounded-full", group.color?.replace("text-", "bg-"))} />
                                                    <span className="font-medium">{group.label}</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveGroup(group.id)}
                                                    className="text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!name.trim() || createProduct.isPending || updateProduct.isPending}
                    >
                        {(createProduct.isPending || updateProduct.isPending) ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                {isEditing ? <Edit className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                {isEditing ? "Salvar Alterações" : "Criar Produto"}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
