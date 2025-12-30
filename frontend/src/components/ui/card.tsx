import * as React from "react";
import { clsx } from "clsx";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "section-card rounded-3xl px-6 py-5 shadow-[0_24px_60px_-45px_rgba(30,20,12,0.5)]",
        className,
      )}
      {...props}
    />
  );
}
