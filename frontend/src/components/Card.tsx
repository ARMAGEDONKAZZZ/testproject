import type { HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-border-subtle bg-bg-secondary p-6",
        className,
      )}
      {...rest}
    />
  );
}
