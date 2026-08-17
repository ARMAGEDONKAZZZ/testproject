/**
 * Recommended-task card: checkerboard board preview with a translucent
 * queen watermark and a label caption, per
 * docs/design-audit/puzzle-generation.md Экран 1 ("3 карточки с превью
 * шахматной доски ... полупрозрачная фигура-иконка ферзя по центру").
 */
export function RecommendedCard({
  label,
  selected,
  highlight,
  onClick,
}: {
  label: string;
  selected: boolean;
  /** Onboarding home-tour step 3 points at these cards — see useHomeTour. */
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative aspect-square overflow-hidden rounded-2xl border text-left transition-colors ${
        highlight
          ? "border-accent-green shadow-[0_0_0_3px_rgba(34,197,94,0.4)]"
          : selected
            ? "border-accent-violet"
            : "border-border-subtle hover:border-accent-violet/60"
      }`}
      style={{
        backgroundImage:
          "linear-gradient(45deg, #B38867 25%, transparent 25%), linear-gradient(-45deg, #B38867 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #B38867 75%), linear-gradient(-45deg, transparent 75%, #B38867 75%)",
        backgroundSize: "28px 28px",
        backgroundColor: "#EFD9B8",
        backgroundPosition: "0 0, 0 14px, 14px -14px, -14px 0",
      }}
    >
      <div className="absolute inset-0 bg-bg-primary/60" />
      <span className="absolute inset-0 flex items-center justify-center text-5xl text-white/25">♛</span>
      <span
        className={`absolute inset-x-0 bottom-0 px-3 py-2 text-sm font-medium text-white ${
          selected ? "bg-accent-violet/40" : "bg-black/40"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
