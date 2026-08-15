import type { HTMLAttributes } from "react";
import clsx from "clsx";

type Tone = "neutral" | "green" | "violet" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-bg-elevated text-text-secondary",
  green: "bg-accent-green/15 text-accent-green",
  violet: "bg-accent-violet/15 text-accent-violet-light",
  danger: "bg-danger/15 text-danger",
};

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Pill({ tone = "neutral", className, ...rest }: PillProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
      {...rest}
    />
  );
}
