import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

/** Legacy app button (ng-* tokens). Kept for existing forms. */
export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-3.5 py-2.5",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "ng-btn-primary",
  secondary: "ng-btn-secondary",
  ghost: "ng-btn-ghost",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = "",
) {
  return `ng-btn ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim();
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

/** shadcn-compatible variants used by Pagination / Select triggers. */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-on-accent hover:bg-accent-strong",
        destructive: "bg-neg text-on-accent hover:opacity-90",
        outline:
          "border border-line bg-transparent text-text shadow-xs hover:bg-surface-2",
        secondary: "bg-surface-2 text-text hover:bg-surface",
        ghost: "text-muted hover:bg-surface-2 hover:text-text",
        link: "text-accent-strong underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ShadcnButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;
