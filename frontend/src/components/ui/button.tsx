import * as React from "react";
import { clsx } from "clsx";

const baseStyles =
  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500";

const variants = {
  primary: "bg-ink-900 text-base-50 hover:bg-ink-700",
  ghost: "border border-ink-900/20 text-ink-900 hover:border-ink-900",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={clsx(baseStyles, variants[variant], className)} {...props} />;
}
