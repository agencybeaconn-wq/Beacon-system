import React, { useState, useCallback, useMemo } from 'react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';

interface ColumnDef {
    id: string;
    label: string;
    sortKey?: string; // Key for sorting, if sortable
    width?: string;
    align?: 'left' | 'center' | 'right';
}

interface DraggableTableHeaderProps {
    columns: ColumnDef[];
    onReorder: (fromIndex: number, toIndex: number) => void;
    onSort?: (sortKey: string) => void;
    currentSortKey?: string;
    currentSortDirection?: 'asc' | 'desc' | null;
    className?: string;
}

export function DraggableTableHeader({
    columns,
    onReorder,
    onSort,
    currentSortKey,
    currentSortDirection,
    className,
}: DraggableTableHeaderProps) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());

        // Create custom drag image
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        e.dataTransfer.setDragImage(target, rect.width / 2, rect.height / 2);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedIndex !== null && draggedIndex !== index) {
            setDragOverIndex(index);
        }
    }, [draggedIndex]);

    const handleDragLeave = useCallback(() => {
        setDragOverIndex(null);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== toIndex) {
            onReorder(draggedIndex, toIndex);
        }
        setDraggedIndex(null);
        setDragOverIndex(null);
        setIsDragging(false);
    }, [draggedIndex, onReorder]);

    const handleDragEnd = useCallback(() => {
        setDraggedIndex(null);
        setDragOverIndex(null);
        setIsDragging(false);
    }, []);

    const handleClick = useCallback((column: ColumnDef) => {
        if (column.sortKey && onSort) {
            onSort(column.sortKey);
        }
    }, [onSort]);

    const getSortIcon = useCallback((sortKey?: string) => {
        if (!sortKey || !currentSortKey || currentSortKey !== sortKey) {
            return null;
        }
        if (currentSortDirection === 'asc') {
            return <ArrowUp className="h-3 w-3 text-primary" />;
        }
        if (currentSortDirection === 'desc') {
            return <ArrowDown className="h-3 w-3 text-primary" />;
        }
        return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
    }, [currentSortKey, currentSortDirection]);

    return (
        <>
            {columns.map((column, index) => (
                <TableHead
                    key={column.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleClick(column)}
                    className={cn(
                        // Base styles
                        "text-left font-bold px-3 py-3 whitespace-nowrap select-none transition-all duration-150",
                        // Separator line (subtle gray border on right)
                        "border-r border-border/20",
                        // Width
                        column.width,
                        // Alignment
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        // Sortable cursor
                        column.sortKey && "cursor-pointer hover:bg-muted/50",
                        // Dragging state
                        isDragging && "cursor-grabbing",
                        draggedIndex === index && "opacity-50 bg-primary/10",
                        dragOverIndex === index && "bg-primary/20 border-l-2 border-l-primary",
                        // Not sorting = draggable cursor
                        !column.sortKey && "cursor-grab active:cursor-grabbing",
                        className
                    )}
                    style={{
                        minWidth: column.width || 'auto',
                    }}
                >
                    <div className="flex items-center gap-1.5 group">
                        {/* Drag handle indicator (subtle) */}
                        <GripVertical className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors flex-shrink-0" />

                        {/* Column label */}
                        <span className="truncate">{column.label}</span>

                        {/* Sort icon */}
                        {getSortIcon(column.sortKey)}
                    </div>
                </TableHead>
            ))}
        </>
    );
}

// Helper to build column definitions from preset columns
export function buildColumnDefs(
    orderedColumns: string[],
    translations: Record<string, string>,
    sortableColumns: Record<string, string> = {}
): ColumnDef[] {
    return orderedColumns.map(colId => ({
        id: colId,
        label: translations[colId] || colId,
        sortKey: sortableColumns[colId],
        align: colId === 'status' ? 'center' : 'left',
        width: colId === 'status' ? 'w-[70px]' : undefined,
    }));
}
