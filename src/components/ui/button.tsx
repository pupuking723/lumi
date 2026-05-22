import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-[#2b2938]/10 bg-[#282638] text-white shadow-[0_14px_34px_rgba(38,36,52,0.22)] hover:bg-[#343145]",
  secondary:
    "border border-white/75 bg-[#f7f6f8]/76 text-[#302d43] shadow-[0_1px_0_rgba(255,255,255,0.88)_inset,0_10px_24px_rgba(43,39,58,0.08)] backdrop-blur-xl hover:bg-white/86",
  ghost: "text-[#6f6880] hover:bg-white/58",
  danger: "border border-[#ead1d8] bg-[#fff3f5]/82 text-[#9c4a61] hover:bg-[#ffe8ed]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-13 px-5 text-base",
  icon: "size-11 p-0",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", type = "button", ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-[18px] font-extrabold transition duration-200 disabled:pointer-events-none disabled:opacity-42",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
