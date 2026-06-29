import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleButtonProps {
    className?: string;
    variant?: "ghost" | "outline" | "default";
    size?: "icon" | "sm" | "default";
}

export function ThemeToggleButton({
    className,
    variant = "ghost",
    size = "icon"
}: ThemeToggleButtonProps) {
    const { theme, setTheme } = useTheme();

    return (
        <Button
            variant={variant}
            size={size}
            className={cn("h-8 w-8 hover:bg-primary/10", className)}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
            {theme === "dark" ? (
                <Sun className="h-4 w-4 text-yellow-500" />
            ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
            )}
        </Button>
    );
}
