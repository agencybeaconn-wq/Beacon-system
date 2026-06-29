import { useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DataConfig } from '@/hooks/useSmartData';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface SmartDataTableProps {
    data: any[];
    config: DataConfig;
    onDataUpdate: (newData: any[]) => void;
}

export function SmartDataTable({ data, config, onDataUpdate }: SmartDataTableProps) {
    const parentRef = useRef<HTMLDivElement>(null);
    const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);

    const rowVirtualizer = useVirtualizer({
        count: data.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45,
        overscan: 10,
    });

    const headers = Object.keys(data[0] || {});

    const handleCellBlur = (rowIndex: number, field: string, value: string) => {
        const newData = [...data];
        newData[rowIndex] = { ...newData[rowIndex], [field]: value };
        onDataUpdate(newData);
        setEditingCell(null);
    };

    return (
        <div className="flex flex-col h-[600px] w-full bg-background">
            <div className="flex bg-muted/50 border-b border-border/50 sticky top-0 z-10 sticky-header">
                {headers.map((h, i) => (
                    <div
                        key={i}
                        className={cn(
                            "px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground flex-1 min-w-[150px] border-r border-border/20 last:border-0",
                            (config?.layout_priority || []).includes(h) && "text-primary"
                        )}
                    >
                        {h}
                    </div>
                ))}
            </div>

            <div
                ref={parentRef}
                className="flex-1 overflow-auto contain-strict"
            >
                <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                        <div
                            key={virtualRow.index}
                            className="flex border-b border-border/10 hover:bg-muted/30 transition-colors group"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                        >
                            {headers.map((h, i) => (
                                <div
                                    key={i}
                                    onDoubleClick={() => setEditingCell({ row: virtualRow.index, field: h })}
                                    className={cn(
                                        "px-4 py-2 text-sm flex-1 min-w-[150px] border-r border-border/10 last:border-0 cursor-text flex items-center",
                                        (config?.layout_priority || []).includes(h) && "font-semibold bg-primary/5"
                                    )}
                                >
                                    {editingCell?.row === virtualRow.index && editingCell?.field === h ? (
                                        <Input
                                            autoFocus
                                            defaultValue={data[virtualRow.index][h]}
                                            className="h-7 text-sm px-2 bg-background shadow-none focus-visible:ring-1"
                                            onBlur={(e) => handleCellBlur(virtualRow.index, h, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleCellBlur(virtualRow.index, h, (e.target as HTMLInputElement).value);
                                                if (e.key === 'Escape') setEditingCell(null);
                                            }}
                                        />
                                    ) : (
                                        <span className="truncate">
                                            {(config?.data_types?.[h]) === 'currency'
                                                ? parseFloat(data[virtualRow.index][h]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                : data[virtualRow.index][h]}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
