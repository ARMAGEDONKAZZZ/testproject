import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { toast } from "@/components/Toast";
import { useHintPackages, usePurchaseHintPackage } from "@/features/billing/hooks";

interface HintPaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attemptId: string;
}

export function HintPaywallModal({ open, onOpenChange, attemptId }: HintPaywallModalProps) {
  const { t } = useTranslation();
  const { data: packages } = useHintPackages();
  const purchase = usePurchaseHintPackage();
  const featured = packages?.find((p) => p.isFeatured);
  const [selected, setSelected] = useState<string | null>(null);

  const selectedId = selected ?? featured?.id ?? packages?.[0]?.id ?? null;

  async function handleBuy() {
    if (!selectedId) return;
    try {
      await purchase.mutateAsync({ packageId: selectedId, attemptId });
      toast.success("Подсказки куплены");
      onOpenChange(false);
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("puzzle.hintsExhausted")}>
      <p className="mb-4 text-sm text-text-secondary">{t("puzzle.hintsExhaustedSubtitle")}</p>
      <p className="mb-2 text-xs uppercase text-text-muted">{t("puzzle.getMoreHints")}</p>
      <div className="space-y-2">
        {(packages ?? []).map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => setSelected(pkg.id)}
            className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${
              selectedId === pkg.id
                ? "border-accent-violet bg-accent-violet/10"
                : "border-border-subtle bg-bg-tertiary"
            }`}
          >
            <span className="flex items-center gap-2 text-sm text-text-primary">
              {pkg.label}
              {pkg.isFeatured && <Pill tone="green">{t("billing.featured")}</Pill>}
            </span>
            <span className="text-sm text-text-secondary">{pkg.priceCredits} ⚡</span>
          </button>
        ))}
      </div>
      <Button className="mt-4 w-full" loading={purchase.isPending} onClick={() => void handleBuy()}>
        {t("puzzle.buy")}
      </Button>
      <button
        onClick={() => onOpenChange(false)}
        className="mt-3 w-full text-center text-sm text-text-secondary hover:text-text-primary"
      >
        {t("puzzle.continueWithoutHints")}
      </button>
    </Modal>
  );
}
