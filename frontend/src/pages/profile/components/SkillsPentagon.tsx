import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { toast } from "@/components/Toast";
import type { SkillProfile } from "@/features/profile/hooks";
import { useSetFocusAxes } from "@/features/profile/hooks";

const AXES: { key: keyof Omit<SkillProfile, "overall" | "focusAxes">; label: string }[] = [
  { key: "tactics", label: "Tactics" },
  { key: "strategy", label: "Strategy" },
  { key: "openings", label: "Openings" },
  { key: "endgames", label: "Endgames" },
  { key: "calculation", label: "Calculation" },
];

function pointFor(index: number, value: number, size: number) {
  const angle = (-90 + index * 72) * (Math.PI / 180);
  const radius = (value / 100) * (size / 2 - 20);
  const cx = size / 2;
  const cy = size / 2;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

export function SkillsPentagon({ skills, hideEdit }: { skills: SkillProfile; hideEdit?: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const size = 220;
  const points = AXES.map((axis, i) => pointFor(i, skills[axis.key], size));
  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div>
      <div className="flex items-center gap-6">
        <svg width={size} height={size}>
          {AXES.map((_, i) => {
            const p = pointFor(i, 100, size);
            return (
              <line key={i} x1={size / 2} y1={size / 2} x2={p.x} y2={p.y} stroke="#2E334E" strokeWidth={1} />
            );
          })}
          <polygon points={polygon} fill="#7B61FF33" stroke="#7B61FF" strokeWidth={2} />
          <text x={size / 2} y={size / 2} textAnchor="middle" fill="#F4F7FA" fontSize={20} fontWeight={700}>
            {skills.overall}
          </text>
        </svg>
        <div className="flex-1 space-y-2">
          {AXES.map((axis) => (
            <div key={axis.key}>
              <div className="flex justify-between text-xs text-text-secondary">
                <span>{axis.label}</span>
                <span>{skills[axis.key]}</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-elevated">
                <div className="h-full rounded-full bg-accent-violet" style={{ width: `${skills[axis.key]}%` }} />
              </div>
            </div>
          ))}
          {!hideEdit && (
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              ⚡ Edit
            </Button>
          )}
        </div>
      </div>

      {!hideEdit && <FocusAxesModal open={editOpen} onOpenChange={setEditOpen} initial={skills.focusAxes} />}
    </div>
  );
}

function FocusAxesModal({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  const setFocusAxes = useSetFocusAxes();

  function toggle(key: string) {
    setSelected((s) => {
      if (s.includes(key)) return s.filter((k) => k !== key);
      if (s.length >= 3) {
        toast.error("Можно выбрать не более 3 навыков");
        return s;
      }
      return [...s, key];
    });
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Chess Skills Pentagon">
      <p className="mb-3 text-sm text-text-secondary">
        Выберите не более 3 навыков для фокусировки тренировок
      </p>
      <div className="space-y-1">
        {AXES.map((axis) => (
          <label key={axis.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-elevated">
            <input type="checkbox" checked={selected.includes(axis.key)} onChange={() => toggle(axis.key)} />
            <span className="text-sm text-text-primary">{axis.label}</span>
          </label>
        ))}
      </div>
      <Button
        className="mt-4 w-full"
        loading={setFocusAxes.isPending}
        onClick={() => {
          setFocusAxes.mutate(selected);
          onOpenChange(false);
        }}
      >
        Save Changes
      </Button>
    </Modal>
  );
}
