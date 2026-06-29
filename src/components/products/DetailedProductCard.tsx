import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
    Check, Plus, Trash2, LayoutDashboard, Database, Repeat, Zap,
    HeartHandshake, Loader2, GripVertical, MoreVertical, X,
    ChevronDown, ChevronUp, Edit, Palette, Star, Package,
    ShoppingBag, Code, Globe, ImageIcon, Workflow, Calendar, TrendingUp
} from "lucide-react";
import { AgencyProduct, ProductFeature, useAgencyProducts, getPricingLabel, getPricingColor, ICON_OPTIONS, COLOR_OPTIONS } from "@/hooks/useAgencyProducts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
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

// DnD Imports
import {
    DndContext,
    closestCenter,
    rectIntersection,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragEndEvent,
    DragStartEvent,
    DragOverEvent,
    useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
    useSortable,
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { FeatureDetailSheet } from "./FeatureDetailSheet";
import { SortableFeatureItem } from "./SortableFeatureItem";
import { ProductFormModal } from "./ProductFormModal";
import { usePermissions } from "@/contexts/PermissionsContext";

const ICON_MAP: any = {
    LayoutDashboard, Database, Repeat, Zap, HeartHandshake, Check,
    Star, Package, ShoppingBag, Code, Palette, Globe, ImageIcon, Workflow, Calendar, TrendingUp
};

const DEFAULT_PILLARS = [
    { id: "Estratégico", label: "Estratégico", icon: "LayoutDashboard", color: "text-purple-500" },
    { id: "Ativos Shopify", label: "Ativos Shopify", icon: "Database", color: "text-blue-500" },
    { id: "Operacional Mensal", label: "Operacional Mensal", icon: "Repeat", color: "text-emerald-500" },
    { id: "Automações & Retenção", label: "Automações & Retenção", icon: "Zap", color: "text-yellow-500" },
    { id: "Suporte", label: "Suporte", icon: "HeartHandshake", color: "text-pink-500" },
    { id: "Geral", label: "Geral / Outros", icon: "Check", color: "text-gray-500" },
];

interface DroppableCategoryProps {
    group: any;
    items: ProductFeature[];
    editingFeatureId: string | null;
    editingFeatureValue: string;
    setEditingFeatureId: (id: string | null) => void;
    setEditingFeatureValue: (val: string) => void;
    handleSaveFeature: (id: string) => void;
    handleDeleteFeature: (id: string) => void;
    addingToCategory: string | null;
    setAddingToCategory: (id: string | null) => void;
    newFeatureName: string;
    setNewFeatureName: (val: string) => void;
    handleAddFeature: (category: string) => void;
    handleDeleteGroup: (id: string) => void;
    canEdit: boolean;
    editingGroupId: string | null;
    editingGroupValue: string;
    setEditingGroupId: (id: string | null) => void;
    setEditingGroupValue: (val: string) => void;
    handleSaveGroup: (id: string) => void;
    handleSaveGroupStyle: (id: string, updatedGroup: any) => void;
    onFeatureClick: (feature: ProductFeature) => void;
}

export function DroppableCategory({
    group,
    items,
    handleSaveGroup,
    handleSaveGroupStyle,
    onFeatureClick,
    editingFeatureId,
    editingFeatureValue,
    setEditingFeatureId,
    setEditingFeatureValue,
    handleSaveFeature,
    handleDeleteFeature,
    addingToCategory,
    setAddingToCategory,
    newFeatureName,
    setNewFeatureName,
    handleAddFeature,
    handleDeleteGroup,
    canEdit,
    editingGroupId,
    editingGroupValue,
    setEditingGroupId,
    setEditingGroupValue,
}: DroppableCategoryProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: group.id,
        data: { type: 'group', group }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };


    const Icon = ICON_MAP[group.icon || "Check"] || Check;

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "border rounded-md bg-white dark:bg-card overflow-hidden h-full transition-all dark:border-border"
            )}
            style={style as any}
        >
            <div className="flex items-center justify-between p-3 border-b bg-slate-50/50 dark:bg-muted/20 dark:border-border">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors">
                        <GripVertical className="w-4 h-4 text-slate-300" />
                    </div>
                    <div
                        className={cn("p-1.5 rounded-sm bg-white dark:bg-card border dark:border-border")}
                        style={(group.color || "").startsWith('#') ? { color: group.color } : undefined}
                    >
                        <Icon
                            className={cn("w-4 h-4")}
                        />
                    </div>
                    {editingGroupId === group.id ? (
                        <Input
                            value={editingGroupValue}
                            onChange={(e) => setEditingGroupValue(e.target.value)}
                            onBlur={() => handleSaveGroup(group.id)}
                            onKeyDown={(e) => e.key === "Enter" && handleSaveGroup(group.id)}
                            className="h-7 w-48 text-sm font-semibold"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <div className="flex items-center gap-2 group/title">
                            <span className="font-semibold text-foreground truncate">{group.label}</span>
                            {canEdit && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingGroupId(group.id);
                                        setEditingGroupValue(group.label);
                                    }}
                                    className="p-1 rounded hover:bg-muted opacity-0 group-hover/title:opacity-100 transition-opacity"
                                >
                                    <Edit className="w-3 h-3 text-muted-foreground" />
                                </button>
                            )}
                        </div>
                    )}
                    <Badge variant="secondary" className="ml-2 text-xs shrink-0">{items.length}</Badge>
                </div>

                {canEdit && (
                    <div className="flex items-center gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={() => {
                                    setEditingGroupId(group.id);
                                    setEditingGroupValue(group.label);
                                }}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Renomear
                                </DropdownMenuItem>

                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                        <Palette className="w-4 h-4 mr-2" />
                                        <span>Trocar Cor</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="p-2 min-w-[180px]">
                                            <div className="grid grid-cols-5 gap-1">
                                                {COLOR_OPTIONS.map((color) => (
                                                    <button
                                                        key={color}
                                                        className={cn(
                                                            "w-6 h-6 rounded-md border border-white/10 transition-transform hover:scale-110",
                                                            group.color === color ? "ring-2 ring-primary ring-offset-1" : ""
                                                        )}
                                                        style={{ backgroundColor: color }}
                                                        onClick={() => {
                                                            const updatedGroup = { ...group, color };
                                                            handleSaveGroupStyle(group.id, updatedGroup);
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>

                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                        <LayoutDashboard className="w-4 h-4 mr-2" />
                                        <span>Trocar Ícone</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="p-2 min-w-[200px] max-h-[300px] overflow-y-auto">
                                            <div className="grid grid-cols-4 gap-1">
                                                {ICON_OPTIONS.map((iconName) => {
                                                    const IconOption = ICON_MAP[iconName] || Check;
                                                    return (
                                                        <button
                                                            key={iconName}
                                                            className={cn(
                                                                "p-2 rounded-md hover:bg-muted flex items-center justify-center transition-colors",
                                                                group.icon === iconName ? "bg-primary/20 text-primary" : "text-muted-foreground"
                                                            )}
                                                            onClick={() => {
                                                                const updatedGroup = { ...group, icon: iconName };
                                                                handleSaveGroupStyle(group.id, updatedGroup);
                                                            }}
                                                        >
                                                            <IconOption className="w-4 h-4" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>

                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-500 focus:text-red-600 focus:bg-red-500/10" onClick={() => handleDeleteGroup(group.id)}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Excluir Grupo
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>

            <div className="p-4 pt-4 space-y-1">
                <div ref={setNodeRef} className="min-h-[50px]">
                    <SortableContext
                        id={group.id}
                        items={items.map((f: any) => f.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-1 pl-2">
                            {items.length === 0 && (
                                <div className="text-xs text-muted-foreground italic mb-2 ml-9 py-2 border-2 border-dashed border-muted rounded-md px-4 flex justify-center items-center h-16 bg-muted/20">
                                    Arraste itens para cá
                                </div>
                            )}

                            {items.map((feature: any) => (
                                <SortableFeatureItem
                                    key={feature.id}
                                    feature={feature}
                                    editingId={editingFeatureId}
                                    editingValue={editingFeatureValue}
                                    onEditStart={(id, val) => { setEditingFeatureId(id); setEditingFeatureValue(val); }}
                                    onEditCancel={() => setEditingFeatureId(null)}
                                    onEditSave={handleSaveFeature}
                                    onEditChange={setEditingFeatureValue}
                                    onDelete={handleDeleteFeature}
                                    onClick={() => onFeatureClick(feature)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </div>

                <div className="mt-2 ml-9">
                    {canEdit && (
                        addingToCategory === group.id ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={newFeatureName}
                                    onChange={(e) => setNewFeatureName(e.target.value)}
                                    placeholder="Novo item..."
                                    className="h-8 text-sm"
                                    autoFocus
                                    onKeyDown={(e) => e.key === "Enter" && handleAddFeature(group.id)}
                                />
                                <Button size="icon" variant="ghost" onClick={() => handleAddFeature(group.id)} className="h-8 w-8 hover:bg-green-500/10">
                                    <Check className="w-4 h-4 text-green-500" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => { setAddingToCategory(null); setNewFeatureName(""); }} className="h-8 w-8 hover:bg-red-500/10">
                                    <X className="w-4 h-4 text-red-500" />
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAddingToCategory(group.id)}
                                className="h-7 text-xs text-muted-foreground hover:text-primary px-2 -ml-2"
                            >
                                <Plus className="w-3 h-3 mr-1" />
                                Adicionar item
                            </Button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

interface DetailedProductCardProps {
    product: AgencyProduct;
    defaultExpanded?: boolean;
}

export function DetailedProductCard({ product, defaultExpanded = true }: DetailedProductCardProps) {
    const { updateProduct, addFeature, updateFeature, updateFeaturesBatch, deleteFeature, deleteProduct } = useAgencyProducts();
    const { canEdit } = usePermissions();
    const canEditProducts = canEdit('products');
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [isEditingProduct, setIsEditingProduct] = useState(false);

    // State
    const [activeId, setActiveId] = useState<string | null>(null);
    const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
    const [editingFeatureValue, setEditingFeatureValue] = useState("");
    const [newFeatureName, setNewFeatureName] = useState("");
    const [addingToCategory, setAddingToCategory] = useState<string | null>(null);

    // Group Management State
    const [newGroupName, setNewGroupName] = useState("");
    const [isAddingGroup, setIsAddingGroup] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingGroupValue, setEditingGroupValue] = useState("");

    const [selectedFeature, setSelectedFeature] = useState<ProductFeature | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    // Derived State
    const groups = useMemo(() => product.groups || DEFAULT_PILLARS, [product.groups]);
    const features = useMemo(() => product.features || [], [product.features]);

    // Local state for features to allow smooth drag updates before server sync
    const [items, setItems] = useState<ProductFeature[]>(features);

    useEffect(() => {
        setItems(features);
    }, [features]);

    // Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Calculate progress
    const totalFeatures = items.length;
    const completedFeatures = items.filter(f => f.is_checked).length;
    const progress = totalFeatures > 0 ? (completedFeatures / totalFeatures) * 100 : 0;

    // Actions
    const handleSaveFeature = async (featureId: string) => {
        if (editingFeatureValue.trim()) {
            const updatedItems = items.map(f => f.id === featureId ? { ...f, name: editingFeatureValue.trim() } : f);
            setItems(updatedItems);

            await updateFeature.mutateAsync({ id: featureId, name: editingFeatureValue.trim() });
        }
        setEditingFeatureId(null);
        setEditingFeatureValue("");
    };

    const handleAddFeature = async (category: string) => {
        if (newFeatureName.trim()) {
            await addFeature.mutateAsync({
                productId: product.id,
                name: newFeatureName.trim(),
                category: category,
                is_checked: false
            });
            setNewFeatureName("");
            setAddingToCategory(null);
        }
    };

    const handleDeleteFeature = async (featureId: string) => {
        const updatedItems = items.filter(f => f.id !== featureId);
        setItems(updatedItems);
        await deleteFeature.mutateAsync(featureId);
    };

    // Group Management
    const handleAddGroup = async () => {
        if (newGroupName.trim()) {
            const newGroup = {
                id: `group_${Date.now()}`,
                label: newGroupName.trim(),
                icon: "Check",
                color: "text-gray-500"
            };
            const updatedGroups = [...groups, newGroup];
            await updateProduct.mutateAsync({ id: product.id, groups: updatedGroups });
            setNewGroupName("");
            setIsAddingGroup(false);
        }
    };

    const handleSaveGroup = async (groupId: string) => {
        if (editingGroupValue.trim()) {
            const updatedGroups = groups.map(g => g.id === groupId ? { ...g, label: editingGroupValue.trim() } : g);
            await updateProduct.mutateAsync({ id: product.id, groups: updatedGroups });
        }
        setEditingGroupId(null);
        setEditingGroupValue("");
    };

    const handleSaveGroupStyle = async (groupId: string, updatedGroup: any) => {
        const updatedGroups = groups.map(g => g.id === groupId ? updatedGroup : g);
        await updateProduct.mutateAsync({ id: product.id, groups: updatedGroups });
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (confirm("Tem certeza? Itens neste grupo serão movidos para 'Geral'.")) {
            // Update items to 'Geral' first? Or just let them be orphaned (default category logic needed)
            // Ideally move them to 'Geral'
            const itemsInGroup = items.filter(f => (f.category || 'Geral') === groupId);
            if (itemsInGroup.length > 0) {
                const batchUpdates = itemsInGroup.map(item => ({ id: item.id, category: 'Geral' }));
                await updateFeaturesBatch.mutateAsync(batchUpdates);
            }

            const updatedGroups = groups.filter(g => g.id !== groupId);
            await updateProduct.mutateAsync({ id: product.id, groups: updatedGroups });
        }
    };

    // DnD Handlers
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // Find the containers
        const activeContainer = findContainer(activeId);
        const overContainer = findContainer(overId);

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        setItems((prev) => {
            const activeItems = prev.filter(f => (f.category || 'Geral') === activeContainer);
            const overItems = prev.filter(f => (f.category || 'Geral') === overContainer);

            const activeIndex = activeItems.findIndex(f => f.id === activeId);
            const overIndex = overItems.findIndex(f => f.id === overId);

            let newIndex;
            if (overIndex >= 0) {
                newIndex = overIndex;
            } else {
                newIndex = overItems.length;
            }

            return prev.map(item => {
                if (item.id === activeId) {
                    return { ...item, category: overContainer, sort_order: newIndex };
                }
                return item;
            });
        });
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        console.log('Drag End:', { activeId, overId, activeType: active.data.current?.type });

        // 1. Handle Group (Block) Reordering
        if (active.data.current?.type === 'group') {
            if (activeId !== overId) {
                const oldIndex = groups.findIndex(g => g.id === activeId);
                const newIndex = groups.findIndex(g => g.id === overId);
                const updatedGroups = arrayMove(groups, oldIndex, newIndex);
                await updateProduct.mutateAsync({ id: product.id, groups: updatedGroups });
            }
            return;
        }

        // 2. Handle Item (Product) Reordering
        const activeContainer = findContainer(activeId);
        const overContainer = findContainer(overId);

        if (activeContainer && overContainer) {
            const activeIndex = items.findIndex((i) => i.id === activeId);
            const overIndex = items.findIndex((i) => i.id === overId);

            let newItems = [...items];

            if (activeContainer === overContainer) {
                if (activeIndex !== overIndex) {
                    newItems = arrayMove(items, activeIndex, overIndex);
                    setItems(newItems);
                }
            } else {
                newItems = items.map(f =>
                    f.id === activeId ? { ...f, category: overContainer } : f
                );

                // If dropped over a specific item in the new container, move it there
                if (overIndex !== -1) {
                    const movedItem = newItems.find(f => f.id === activeId)!;
                    const filteredItems = newItems.filter(f => f.id !== activeId);
                    filteredItems.splice(overIndex, 0, movedItem);
                    newItems = filteredItems;
                }

                setItems(newItems);
            }

            // Sync EVERYTHING in the affected containers to ensure sort_order is correct
            const containersToUpdate = [activeContainer, overContainer];
            const batchUpdates: any[] = [];

            newItems.forEach((item, index) => {
                const itemContainer = item.category || 'Geral';
                if (containersToUpdate.includes(itemContainer)) {
                    // Find all items in this container to calc their relative order
                    const siblings = newItems.filter(f => (f.category || 'Geral') === itemContainer);
                    const relativeOrder = siblings.findIndex(f => f.id === item.id);
                    batchUpdates.push({
                        id: item.id,
                        product_id: item.product_id,
                        name: item.name,
                        category: itemContainer,
                        sort_order: relativeOrder
                    });
                }
            });

            if (batchUpdates.length > 0) {
                console.log('Saving batch updates:', batchUpdates);
                await updateFeaturesBatch.mutateAsync(batchUpdates);
            }
        }
    };

    const findContainer = (id: string) => {
        if (groups.find(g => g.id === id)) return id;
        const item = items.find(f => f.id === id);
        return item ? (item.category || 'Geral') : null;
    };

    // Simplified theme (Lever Identity - Light)
    const categoryTheme = useMemo(() => {
        if (product.is_flagship) return {
            headerBg: "bg-white dark:bg-card",
            headerBorder: "border-primary/20 dark:border-primary/10",
            titleText: "text-slate-900 dark:text-foreground",
            descText: "text-slate-500 dark:text-muted-foreground",
            accent: "text-primary",
            badge: "bg-primary/5 text-primary border-primary/20",
        };
        return {
            headerBg: "bg-white dark:bg-card",
            headerBorder: "border-border/10 dark:border-border",
            titleText: "text-slate-900 dark:text-foreground",
            descText: "text-slate-500 dark:text-muted-foreground",
            accent: "text-primary",
            badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
        };
    }, [product.category, product.is_flagship]);

    return (
        <div className="w-full bg-white dark:bg-card border dark:border-border rounded-md overflow-hidden shadow-sm">
            {/* Header Section - Clean & Light */}
            <div className={cn("relative p-6 border-b", categoryTheme.headerBg, categoryTheme.headerBorder)}>
                {product.is_flagship && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                )}
                <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                    <div className="flex-1 truncate">
                        <div className="flex items-center gap-2 mb-1">
                            {product.is_flagship && (
                                <Star className="w-5 h-5 text-primary fill-primary" />
                            )}
                            <h2 className={cn("text-2xl font-bold truncate", categoryTheme.titleText)}>{product.name}</h2>
                        </div>

                        <p className={cn("max-w-2xl text-xs line-clamp-1", categoryTheme.descText)}>{product.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        {canEditProducts && (
                            <ProductFormModal
                                open={isEditingProduct}
                                onOpenChange={setIsEditingProduct}
                                product={product}
                                trigger={
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-slate-400 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground hover:bg-slate-100 dark:hover:bg-muted h-8 w-8"
                                        onClick={() => setIsEditingProduct(true)}
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                }
                            />
                        )}

                        <Button
                            variant="ghost"
                            className="text-slate-400 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground hover:bg-slate-100 dark:hover:bg-muted h-8 w-8"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>

                        {canEditProducts && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500 hover:bg-red-500/10 h-8 w-8">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            O produto <strong>{product.name}</strong> será excluído permanentemente.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => deleteProduct.mutateAsync(product.id)}
                                            className="bg-red-500 hover:bg-red-600"
                                        >
                                            Excluir
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Section */}
            {isExpanded && (
                <div className="p-6 animate-in slide-in-from-top-4 duration-300">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={rectIntersection}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                {groups.map((group) => {
                                    const groupItems = items.filter(f => (f.category || 'Geral') === group.id);
                                    return (
                                        <DroppableCategory
                                            key={group.id}
                                            group={group}
                                            items={groupItems}
                                            editingFeatureId={editingFeatureId}
                                            editingFeatureValue={editingFeatureValue}
                                            setEditingFeatureId={setEditingFeatureId}
                                            setEditingFeatureValue={setEditingFeatureValue}
                                            handleSaveFeature={handleSaveFeature}
                                            handleDeleteFeature={handleDeleteFeature}
                                            addingToCategory={addingToCategory}
                                            setAddingToCategory={setAddingToCategory}
                                            newFeatureName={newFeatureName}
                                            setNewFeatureName={setNewFeatureName}
                                            handleAddFeature={handleAddFeature}
                                            handleDeleteGroup={handleDeleteGroup}
                                            canEdit={canEditProducts}
                                            editingGroupId={editingGroupId}
                                            editingGroupValue={editingGroupValue}
                                            setEditingGroupId={setEditingGroupId}
                                            setEditingGroupValue={setEditingGroupValue}
                                            handleSaveGroup={handleSaveGroup}
                                            handleSaveGroupStyle={handleSaveGroupStyle}
                                            onFeatureClick={(feature) => {
                                                setSelectedFeature(feature);
                                                setIsSheetOpen(true);
                                            }}
                                        />
                                    );
                                })}

                                {/* Add New Group Button */}
                                <div className="border border-dashed rounded-lg bg-muted/20 px-4 py-8 flex items-center justify-center min-h-[200px]">
                                    {canEditProducts && (
                                        isAddingGroup ? (
                                            <div className="flex items-center gap-2 w-full max-w-xs">
                                                <Input
                                                    value={newGroupName}
                                                    onChange={(e) => setNewGroupName(e.target.value)}
                                                    placeholder="Nome do grupo..."
                                                    className="h-9"
                                                    autoFocus
                                                    onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
                                                />
                                                <Button size="icon" variant="ghost" onClick={handleAddGroup}>
                                                    <Check className="w-4 h-4 text-green-500" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={() => setIsAddingGroup(false)}>
                                                    <X className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button variant="outline" onClick={() => setIsAddingGroup(true)} className="gap-2">
                                                <Plus className="w-4 h-4" />
                                                Criar Novo Grupo
                                            </Button>
                                        )
                                    )}
                                </div>
                            </div>
                        </SortableContext>

                        <DragOverlay>
                            {activeId ? (
                                // Determine if we are dragging a group or a feature for the overlay
                                groups.find(g => g.id === activeId) ? (
                                    <div className="w-[400px] border rounded-md bg-white shadow-xl p-4 flex items-center gap-3">
                                        <GripVertical className="w-4 h-4 text-slate-300" />
                                        <span className="font-bold">{groups.find(g => g.id === activeId)?.label}</span>
                                    </div>
                                ) : (
                                    <SortableFeatureItem
                                        feature={items.find(f => f.id === activeId) as ProductFeature}
                                        editingId={null}
                                        editingValue=""
                                        onEditStart={() => { }}
                                        onEditCancel={() => { }}
                                        onEditSave={() => { }}
                                        onEditChange={() => { }}
                                        onDelete={() => { }}
                                    />
                                )
                            ) : null}
                        </DragOverlay>
                    </DndContext>

                    <FeatureDetailSheet
                        featureId={selectedFeature?.id || null}
                        productId={product.id}
                        open={isSheetOpen}
                        onOpenChange={setIsSheetOpen}
                    />
                </div>
            )}
        </div>
    );
}
