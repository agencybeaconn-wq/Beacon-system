import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Alterna claro/escuro. Resolve o tema efetivo (resolvedTheme) porque com
 * enableSystem o valor pode ser "system" — o toggle sempre inverte o que está
 * NA TELA. Só renderiza o ícone após montar, pra não dar mismatch de hidratação.
 */
export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const isDark = resolvedTheme === "dark";

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full press"
            aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
            title={isDark ? "Modo claro" : "Modo escuro"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
        >
            {mounted && (isDark
                ? <Sun className="h-[18px] w-[18px]" />
                : <Moon className="h-[18px] w-[18px]" />)}
        </Button>
    );
}
