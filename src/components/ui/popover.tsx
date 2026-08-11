import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        // Material flutuante: mais leve e mais borrado que a chrome, porque
        // puxa atencao pro elemento interativo (/apple-design §12).
        "mat-float z-50 w-72 rounded-lg border border-border/50 p-4 text-popover-foreground outline-none",
        // Ancoragem: a superficie cresce A PARTIR do trigger, nao do proprio
        // centro. Sem isso a relacao espacial entre botao e conteudo some
        // (§7). O Radix ja calcula a origem — bastava usar.
        "origin-[var(--radix-popover-content-transform-origin)]",
        // Entrada e saida pelo MESMO caminho, com as curvas espelhadas.
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
        "data-[state=open]:ease-material-in data-[state=closed]:ease-material-out",
        "data-[state=open]:duration-200 data-[state=closed]:duration-150",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
