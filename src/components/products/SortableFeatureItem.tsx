import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { ProductFeature } from "@/hooks/useAgencyProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Pencil, Trash2, X, GripVertical } from "lucide-react";

interface SortableFeatureItemProps {
    feature: ProductFeature;
    editingId: string | null;
    editingValue: string;
    onEditStart: (id: string, name: string) => void;
    onEditCancel: () => void;
    onEditSave: (id: string) => void;
    onEditChange: (value: string) => void;
    onDelete: (id: string) => void;
    onClick?: () => void;
}

export function SortableFeatureItem({
    feature,
    editingId,
    editingValue,
    onEditStart,
    onEditCancel,
    onEditSave,
    onEditChange,
    onDelete,
    onClick
}: SortableFeatureItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: feature.id, data: { type: 'feature', feature } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={(e) => {
                // Don't trigger click if we are clicking buttons or inputs
                if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
                onClick?.();
            }}
            className={cn(
                "group flex items-start gap-3 py-1 hover:bg-slate-50/80 rounded-md px-2 transition-colors touch-none cursor-pointer border border-transparent hover:border-slate-100",
                isDragging && "bg-slate-100 border-slate-200"
            )}
        >
            {editingId === feature.id ? (
                <div className="flex-1 flex items-center gap-2">
                    <Input
                        value={editingValue}
                        onChange={(e) => onEditChange(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && onEditSave(feature.id)}
                    />
                    <Button size="icon" variant="ghost" onClick={() => onEditSave(feature.id)} className="h-7 w-7">
                        <Check className="w-3 h-3 text-green-500" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={onEditCancel} className="h-7 w-7">
                        <X className="w-3 h-3 text-red-500" />
                    </Button>
                </div>
            ) : (
                <>
                    {/* Drag Handle */}
                    <div {...attributes} {...listeners} className="mt-1.5 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground">
                        <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 flex items-center justify-between group/item">
                        <div className="flex items-center gap-2 py-1 overflow-hidden">
                            <span className="text-sm text-foreground truncate">
                                {feature.name}
                            </span>
                            {feature.subtasks && feature.subtasks.length > 0 && (
                                <Badge variant="secondary" className="px-1 h-4 text-[9px] bg-slate-100 text-slate-500 border-none shrink-0">
                                    {feature.subtasks.length}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => onEditStart(feature.id, feature.name)}
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            >
                                <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => onDelete(feature.id)}
                                className="h-6 w-6 text-muted-foreground hover:text-red-500"
                            >
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
