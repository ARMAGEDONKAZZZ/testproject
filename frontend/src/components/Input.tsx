import { type InputHTMLAttributes, forwardRef, useId } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs uppercase tracking-wide text-text-muted">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={clsx(
          "rounded-xl border bg-bg-tertiary px-4 py-2.5 text-text-primary placeholder:text-text-muted",
          "focus-visible:outline-none",
          error ? "border-danger" : "border-border-subtle",
          className,
        )}
        {...rest}
      />
      {error && (
        <span id={`${inputId}-error`} role="alert" className="text-sm text-danger">
          {error}
        </span>
      )}
    </div>
  );
});
