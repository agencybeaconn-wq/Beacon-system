import { Badge } from "@/components/ui/badge";
import { Package, Star, ShoppingBag, Code, Palette, Zap, Globe, ImageIcon, Workflow, Calendar, TrendingUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgencyProducts, AgencyProduct, getPricingLabel, getPricingColor } from "@/hooks/useAgencyProducts";
import { Loader2 } from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    Star, Package, ShoppingBag, Code, Palette, Zap, Globe, ImageIcon, Workflow, Calendar, TrendingUp
};

interface AssignedProductsDisplayProps {
    assignedProductIds: string[];
    className?: string;
}

export function AssignedProductsDisplay({ assignedProductIds, className }: AssignedProductsDisplayProps) {
    const { products: allProducts, isLoading } = useAgencyProducts();

    if (isLoading) {
        return (
            <div className={cn("p-4 flex items-center justify-center", className)}>
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
        );
    }

    if (!assignedProductIds || assignedProductIds.length === 0) {
        return (
            <div className={cn("p-4 rounded-lg border border-dashed border-border bg-muted/20", className)}>
                <div className="flex items-center gap-3 text-muted-foreground">
                    <Package className="w-5 h-5" />
                    <span className="text-sm">Nenhum produto atribuído</span>
                </div>
            </div>
        );
    }

    // Filter products that match the assigned IDs
    const assignedProducts = allProducts.filter((p: AgencyProduct) => assignedProductIds.includes(p.id));

    if (assignedProducts.length === 0) {
        return (
            <div className={cn("p-4 rounded-lg border border-dashed border-border bg-muted/20", className)}>
                <div className="flex items-center gap-3 text-muted-foreground">
                    <Package className="w-5 h-5" />
                    <span className="text-sm">Produtos atribuídos não encontrados</span>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Produtos Atribuídos</h3>
                <Badge variant="secondary" className="text-xs">
                    {assignedProducts.length} produto(s)
                </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {assignedProducts.map((product: AgencyProduct) => {
                    const Icon = ICON_MAP[product.icon_name] || Package;
                    return (
                        <div
                            key={product.id}
                            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${product.color}20` }}
                            >
                                <div style={{ color: product.color }}>
                                    <Icon className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">
                                    {product.name}
                                </p>
                                <Badge
                                    variant="outline"
                                    className={cn("text-[10px] font-medium", getPricingColor(product.pricing_type))}
                                >
                                    {getPricingLabel(product.pricing_type)}
                                </Badge>
                            </div>
                            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Converte produtos atribuídos em fases de OnboardingTimeline (Usando produtos dinâmicos)
// Fases são agrupadas por GRUPO/CATEGORIA (Estrutural, Shopify, etc.) com ordem sequencial.
// Apenas a primeira fase começa desbloqueada.
export function useConvertProductsToPhases(assignedProductIds: string[]): import("@/types/lever-os").OnboardingPhase[] {
    const { products: allProducts } = useAgencyProducts();

    // Safety check: ensure allProducts is an array before filtering
    if (!allProducts || !Array.isArray(allProducts)) {
        console.warn("[OnboardingTimeline] Products not loaded yet or invalid.");
        return [];
    }

    const assignedProducts = allProducts.filter((p: AgencyProduct) => assignedProductIds.includes(p.id));

    if (assignedProducts.length === 0) {
        return [];
    }

    // 1. Build ordered group list from all assigned products' groups arrays
    // Features store group.id as their category, so we need to map id -> label
    const orderedGroups: { id: string; label: string }[] = [];
    for (const product of assignedProducts) {
        const groups = product.groups || [];
        for (const group of groups) {
            if (!orderedGroups.some(g => g.id === group.id)) {
                orderedGroups.push({ id: group.id, label: group.label });
            }
        }
    }

    // 2. Flatten all features from all assigned products, preserving product context
    const allFeatures: { feature: import("@/hooks/useAgencyProducts").ProductFeature; product: AgencyProduct; globalIndex: number }[] = [];
    let globalIdx = 0;
    for (const product of assignedProducts) {
        for (const feature of (product.features || [])) {
            allFeatures.push({ feature, product, globalIndex: globalIdx++ });
        }
    }

    // 3. Group features by their category (which is group.id)
    const groupedFeatures: Record<string, typeof allFeatures> = {};
    for (const entry of allFeatures) {
        const categoryId = entry.feature.category || 'Geral';
        if (!groupedFeatures[categoryId]) {
            groupedFeatures[categoryId] = [];
        }
        groupedFeatures[categoryId].push(entry);
    }

    // 4. Build phases in the correct group order
    const phases: import("@/types/lever-os").OnboardingPhase[] = [];
    let phaseIndex = 0;
    for (const group of orderedGroups) {
        const features = groupedFeatures[group.id];
        if (!features || features.length === 0) continue;

        phases.push({
            id: `group-${group.id}`,
            title: group.label, // Display the human-readable label
            isLocked: phaseIndex > 0, // Only first phase is unlocked
            steps: features.map((entry, fIndex) => ({
                id: `${entry.product.id}-step-${(entry.product.features || []).indexOf(entry.feature)}`,
                title: entry.feature.name,
                status: "pending" as const,
                assigneeRole: "head" as const,
                description: undefined,
                initialChecklist: (entry.feature.subtasks || []).map(st => ({
                    id: st.id,
                    title: st.title,
                    isCompleted: st.completed || false,
                })),
            }))
        });
        phaseIndex++;
    }

    // 5. Handle features with no matching group (orphaned in 'Geral')
    const geralFeatures = groupedFeatures['Geral'];
    if (geralFeatures && geralFeatures.length > 0 && !orderedGroups.some(g => g.id === 'Geral')) {
        phases.push({
            id: 'group-geral',
            title: 'Geral',
            isLocked: phaseIndex > 0,
            steps: geralFeatures.map((entry, fIndex) => ({
                id: `${entry.product.id}-step-${(entry.product.features || []).indexOf(entry.feature)}`,
                title: entry.feature.name,
                status: "pending" as const,
                assigneeRole: "head" as const,
                description: undefined,
                initialChecklist: (entry.feature.subtasks || []).map(st => ({
                    id: st.id,
                    title: st.title,
                    isCompleted: st.completed || false,
                })),
            }))
        });
    }

    return phases;
}
