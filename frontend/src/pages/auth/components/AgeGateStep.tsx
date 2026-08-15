import { useTranslation } from "react-i18next";
import clsx from "clsx";

export type AgeTier = "child" | "teen" | "adult";

export function deriveAgeTier(age: number): AgeTier {
  if (age < 12) return "child";
  if (age < 18) return "teen";
  return "adult";
}

interface AgeGateStepProps {
  selected: AgeTier | null;
  onSelect: (tier: AgeTier) => void;
}

const OPTIONS: { tier: AgeTier; labelKey: string; rangeKey: string }[] = [
  { tier: "child", labelKey: "auth.ageChild", rangeKey: "auth.ageChildRange" },
  { tier: "teen", labelKey: "auth.ageTeen", rangeKey: "auth.ageTeenRange" },
  { tier: "adult", labelKey: "auth.ageAdult", rangeKey: "auth.ageAdultRange" },
];

export function AgeGateStep({ selected, onSelect }: AgeGateStepProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.tier}
          type="button"
          onClick={() => onSelect(opt.tier)}
          className={clsx(
            "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors",
            selected === opt.tier
              ? "border-accent-green bg-accent-green/10 text-accent-green"
              : "border-border-subtle bg-bg-tertiary text-text-secondary hover:border-border-subtle/80",
          )}
        >
          <span className="text-sm font-medium">{t(opt.labelKey)}</span>
          <span className="text-xs text-text-muted">{t(opt.rangeKey)}</span>
        </button>
      ))}
    </div>
  );
}
