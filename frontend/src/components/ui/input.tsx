import * as React from "react";
import { clsx } from "clsx";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={clsx(
      "w-full rounded-xl border border-ink-700/20 bg-white/80 px-4 py-2 text-sm text-ink-900 shadow-sm",
      "focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/40",
      className,
    )}
    {...props}
  />
));

Input.displayName = "Input";
