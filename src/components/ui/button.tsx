import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Feedback acontece no pointer-DOWN, nao no release.
 *
 * O `active:scale-[0.97]` e o ponto: esperar o `click` pra reagir e o que faz
 * uma interface parecer morta. 100ms e o teto pra leitura de "instantaneo".
 * `motion-reduce:active:scale-100` respeita quem pediu menos movimento sem
 * tirar o feedback de cor. Ver skill /apple-design §1 e §10.
 */
const buttonVariants = cva(
  // Pill Apple: rounded-full, peso medium, feedback no pointer-down (§1).
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-[background-color,border-color,color,opacity,transform] duration-100 ease-out active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90 border-0 shadow-elev-1",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Outline e secondary viram vidro leve — controle sobre o campo ambiente.
        outline: "border border-border/60 mat-card hover:bg-accent/60 hover:text-accent-foreground",
        secondary: "bg-secondary/70 backdrop-blur-md text-secondary-foreground hover:bg-secondary/90",
        ghost: "hover:bg-accent/60 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
