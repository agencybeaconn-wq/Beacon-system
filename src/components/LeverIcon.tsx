import { cn } from "@/lib/utils";
import nodeTile from "@/assets/node-tile.png";

export function LeverIcon({ className }: { className?: string }) {
    return (
        <div className={cn("flex items-center justify-center rounded-md overflow-hidden bg-white/5", className)}>
            <img src={nodeTile} alt="NODE" className="w-full h-full object-contain" />
        </div>
    );
}

// Para compatibilidade com o tipo LucideIcon esperado pelo MenuItem
export const LeverLogoIcon = (props: any) => {
    return <LeverIcon className={cn("w-5 h-5", props.className)} />;
};
