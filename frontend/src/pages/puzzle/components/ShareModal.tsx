import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { FolderOpen } from "@/components/icons";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToFolder: () => void;
}

/**
 * Per docs/design-audit/toolboard.md section 2 ("Share"), but the real API
 * (contracts/rest-api.md POST /folders/:id/share) only issues links for
 * whole folders, not individual puzzles — so this stays honest about that
 * instead of faking a per-puzzle link the backend can't produce.
 */
export function ShareModal({ open, onOpenChange, onAddToFolder }: ShareModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Поделиться">
      <p className="mb-4 text-sm text-text-secondary">
        Ссылкой можно поделиться на публичную папку целиком. Добавьте эту задачу в публичную папку —
        появится ссылка вида <span className="text-text-primary">neuratop.com/share/…</span>
      </p>
      <Button
        className="w-full"
        onClick={() => {
          onOpenChange(false);
          onAddToFolder();
        }}
      >
        <FolderOpen className="h-4 w-4" /> Добавить в папку
      </Button>
    </Modal>
  );
}
