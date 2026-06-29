import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Pencil, X, Plus, Trash2, Loader2, Star, Package, ShoppingBag, Code, Palette, Zap, Globe, ImageIcon, Workflow, Calendar, TrendingUp } from "lucide-react";
import { AgencyProduct, ProductFeature, useAgencyProducts, getPricingLabel, getPricingColor } from "@/hooks/useAgencyProducts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    Star, Package, ShoppingBag, Code, Palette, Zap, Globe, ImageIcon, Workflow, Calendar, TrendingUp
};



interface EditableProductCardProps {
    product: AgencyProduct;
}

export function EditableProductCard({ product }: EditableProductCardProps) {
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameValue, setNameValue] = useState(product.name);
    const [newFeatureName, setNewFeatureName] = useState("");
    const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
    const [editingFeatureValue, setEditingFeatureValue] = useState("");

    const { updateProduct, deleteProduct, addFeature, updateFeature, deleteFeature } = useAgencyProducts();

    const Icon = ICON_MAP[product.icon_name] || Package;

    const handleSaveName = async () => {
        if (nameValue.trim() && nameValue !== product.name) {
            await updateProduct.mutateAsync({ id: product.id, name: nameValue.trim() });
        }
        setIsEditingName(false);
    };

    const handleAddFeature = async () => {
        if (newFeatureName.trim()) {
            await addFeature.mutateAsync({ productId: product.id, name: newFeatureName.trim() });
            setNewFeatureName("");
        }
    };

    const handleSaveFeature = async (featureId: string) => {
        if (editingFeatureValue.trim()) {
            await updateFeature.mutateAsync({ id: featureId, name: editingFeatureValue.trim() });
        }
        setEditingFeatureId(null);
        setEditingFeatureValue("");
    };

    const handleDeleteFeature = async (featureId: string) => {
        await deleteFeature.mutateAsync(featureId);
    };

    return (
        <div
            className={cn(
                "group relative p-6 bg-card border rounded-xl transition-all duration-300 hover:shadow-lg",
                product.is_flagship && "md:col-span-2 lg:col-span-3 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent"
            )}
        >
            {/* Color Accent */}
            <div
                className="absolute top-0 left-0 w-full h-1.5 rounded-t-xl"
                style={{ backgroundColor: product.color }}
            />

            {/* Pricing Type Badge */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
                <Badge
                    variant="outline"
                    className={cn("text-xs font-medium border", getPricingColor(product.pricing_type))}
                >
                    {getPricingLabel(product.pricing_type)}
                </Badge>

                {/* Delete Product Button */}
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação é irreversível. O produto <strong>{product.name}</strong> será excluído permanentemente.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-red-500 hover:bg-red-600"
                                onClick={() => deleteProduct.mutate(product.id)}
                            >
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            {/* Icon */}
            <div
                className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform",
                    product.is_flagship && "w-16 h-16"
                )}
                style={{ backgroundColor: `${product.color}20` }}
            >
                <Icon className="w-7 h-7" style={{ color: product.color }} />
            </div>

            {/* Editable Name */}
            <div className="mb-2">
                {isEditingName ? (
                    <div className="flex items-center gap-2">
                        <Input
                            value={nameValue}
                            onChange={(e) => setNameValue(e.target.value)}
                            className="text-lg font-bold h-9"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                        />
                        <Button size="icon" variant="ghost" onClick={handleSaveName} className="h-8 w-8">
                            <Check className="w-4 h-4 text-green-500" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { setIsEditingName(false); setNameValue(product.name); }} className="h-8 w-8">
                            <X className="w-4 h-4 text-red-500" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 group/name">
                        <h3 className={cn("font-bold text-foreground", product.is_flagship ? "text-2xl" : "text-lg")}>
                            {product.name}
                            {product.is_flagship && (
                                <Badge className="ml-2 bg-primary text-primary-foreground text-[10px]">Flagship</Badge>
                            )}
                        </h3>
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setIsEditingName(true)}
                            className="h-7 w-7 opacity-0 group-hover/name:opacity-100 transition-opacity"
                        >
                            <Pencil className="w-3 h-3" />
                        </Button>
                    </div>
                )}
            </div>

            <p className="text-sm text-muted-foreground mb-4">{product.description}</p>

            {/* Editable Features */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Executáveis ({product.features?.length || 0})
                    </span>
                </div>

                <ul className="space-y-2">
                    {product.features?.map((feature: ProductFeature) => (
                        <li key={feature.id} className="flex items-start gap-2 group/feature">
                            {editingFeatureId === feature.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                    <Input
                                        value={editingFeatureValue}
                                        onChange={(e) => setEditingFeatureValue(e.target.value)}
                                        className="h-8 text-sm"
                                        autoFocus
                                        onKeyDown={(e) => e.key === "Enter" && handleSaveFeature(feature.id)}
                                    />
                                    <Button size="icon" variant="ghost" onClick={() => handleSaveFeature(feature.id)} className="h-7 w-7">
                                        <Check className="w-3 h-3 text-green-500" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => setEditingFeatureId(null)} className="h-7 w-7">
                                        <X className="w-3 h-3 text-red-500" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                    <span className="text-sm text-muted-foreground flex-1">{feature.name}</span>
                                    <div className="flex gap-1 opacity-0 group-hover/feature:opacity-100 transition-opacity">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => { setEditingFeatureId(feature.id); setEditingFeatureValue(feature.name); }}
                                            className="h-6 w-6"
                                        >
                                            <Pencil className="w-3 h-3" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDeleteFeature(feature.id)}
                                            className="h-6 w-6 text-red-500 hover:text-red-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>

                {/* Add new feature */}
                <div className="flex items-center gap-2 pt-2">
                    <Input
                        value={newFeatureName}
                        onChange={(e) => setNewFeatureName(e.target.value)}
                        placeholder="Novo executável..."
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && handleAddFeature()}
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAddFeature}
                        disabled={!newFeatureName.trim() || addFeature.isPending}
                        className="h-8"
                    >
                        {addFeature.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </Button>
                </div>
            </div>

            {/* Detailed Description */}
            {product.detailed_description && (
                <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {product.detailed_description}
                    </p>
                </div>
            )}
        </div>
    );
}
