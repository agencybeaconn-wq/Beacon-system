import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, Loader2, CheckCheck } from "lucide-react";

export type DemandStatus = 'pending' | 'approved' | 'rejected' | 'in_progress' | 'done';

interface DemandStatusBadgeProps {
    status: DemandStatus;
    className?: string;
}

const statusConfig: Record<DemandStatus, { label: string; icon: any; variant: string; color: string }> = {
    pending: {
        label: 'Pendente',
        icon: Clock,
        variant: 'outline',
        color: 'text-amber-500 border-amber-500/30 bg-amber-500/10'
    },
    approved: {
        label: 'Aprovada',
        icon: CheckCircle2,
        variant: 'outline',
        color: 'text-green-500 border-green-500/30 bg-green-500/10'
    },
    rejected: {
        label: 'Recusada',
        icon: XCircle,
        variant: 'outline',
        color: 'text-red-500 border-red-500/30 bg-red-500/10'
    },
    in_progress: {
        label: 'Em Andamento',
        icon: Loader2,
        variant: 'outline',
        color: 'text-blue-500 border-blue-500/30 bg-blue-500/10'
    },
    done: {
        label: 'Concluída',
        icon: CheckCheck,
        variant: 'outline',
        color: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
    },
};

export function DemandStatusBadge({ status, className }: DemandStatusBadgeProps) {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
        <Badge
            variant="outline"
            className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 font-medium",
                config.color,
                className
            )}
        >
            <Icon className={cn("h-3.5 w-3.5", status === 'in_progress' && "animate-spin")} />
            {config.label}
        </Badge>
    );
}
