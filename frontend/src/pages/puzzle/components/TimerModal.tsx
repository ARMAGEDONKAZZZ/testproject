import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";

const PRESETS = [
  { seconds: 10, label: "10 сек" },
  { seconds: 30, label: "30 сек" },
  { seconds: 60, label: "1 мин" },
  { seconds: 120, label: "2 мин" },
  { seconds: 300, label: "5 мин" },
];

interface TimerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (seconds: number | null, soundEnabled: boolean) => void;
}

/** "Настройка таймера" — per docs/design-audit/toolboard.md section 5. */
export function TimerModal({ open, onOpenChange, onApply }: TimerModalProps) {
  const [countdownOn, setCountdownOn] = useState(true);
  const [seconds, setSeconds] = useState(30);
  const [soundOn, setSoundOn] = useState(true);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Настройка таймера">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-text-primary">Обратный отсчёт</span>
        <Toggle checked={countdownOn} onChange={setCountdownOn} />
      </div>

      <p className="mb-2 text-xs uppercase text-text-muted">Быстрый выбор</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.seconds}
            disabled={!countdownOn}
            onClick={() => setSeconds(preset.seconds)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${
              seconds === preset.seconds
                ? "border-accent-violet bg-accent-violet/10 text-text-primary"
                : "border-border-subtle text-text-secondary"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm text-text-primary">Звуковой сигнал</span>
        <Toggle checked={soundOn} onChange={setSoundOn} />
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
          Отмена
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            onApply(countdownOn ? seconds : null, soundOn);
            onOpenChange(false);
          }}
        >
          Применить
        </Button>
      </div>
    </Modal>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-accent-violet" : "bg-bg-elevated"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
