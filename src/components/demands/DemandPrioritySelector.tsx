import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Flag } from "lucide-react";

export type DemandPriority = 'urgente' | 'alta' | 'normal' | 'baixa';

interface DemandPrioritySelectorProps {
    value: DemandPriority;
    onChange: (value: DemandPriority) => void;
    disabled?: boolean;
    label?: string;
}

const priorityConfig: Record<DemandPriority, { label: string; color: string; bg: string }> = {
    urgente: { label: 'Urgente', color: 'text-red-500', bg: 'bg-red-500/10' },
    alta: { label: 'Alta', color: 'text-amber-500', bg: 'bg-amber-500/10' },
    normal: { label: 'Normal', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    baixa: { label: 'Baixa', color: 'text-gray-400', bg: 'bg-gray-500/10' },
};

export function DemandPrioritySelector({
    value,
    onChange,
    disabled = false,
    label = "Selecionar prioridade"
}: DemandPrioritySelectorProps) {
    const currentConfig = priorityConfig[value] || priorityConfig.normal;

    return (
        <Select value={value} onValueChange={(v) => onChange(v as DemandPriority)} disabled={disabled}>
            <SelectTrigger className={cn(
                "w-full h-12 border-border/50 bg-card hover:bg-muted/50 transition-colors",
                value && currentConfig.bg
            )}>
                <SelectValue placeholder={label}>
                    {value && (
                        <div className="flex items-center gap-2">
                            <Flag className={cn("h-4 w-4", currentConfig.color)} />
                            <span className={cn("font-medium", currentConfig.color)}>
                                {currentConfig.label}
                            </span>
                        </div>
                    )}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {Object.entries(priorityConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key} className="py-3 cursor-pointer">
                        <div className="flex items-center gap-2">
                            <Flag className={cn("h-4 w-4", config.color)} />
                            <span className={cn("font-medium", config.color)}>
                                {config.label}
                            </span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
