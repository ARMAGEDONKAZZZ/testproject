import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";
import { useHistory } from "@/features/folders/hooks";
import { useFolders, useAddToFolders } from "@/features/folders/hooks";
import { PuzzleGrid } from "@/pages/folders/components/PuzzleGrid";

export default function HistoryPage() {
  const { t } = useTranslation();
  const { data: puzzles, isLoading } = useHistory();
  const [pickerPuzzleId, setPickerPuzzleId] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (!puzzles) return [] as { label: string; items: typeof puzzles }[];
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const byLabel = new Map<string, typeof puzzles>();
    for (const p of puzzles) {
      const d = new Date(p.createdAt).toDateString();
      const label = d === today ? "СЕГОДНЯ" : d === yesterday ? "ВЧЕРА" : new Date(p.createdAt).toLocaleDateString("ru-RU");
      byLabel.set(label, [...(byLabel.get(label) ?? []), p]);
    }
    return Array.from(byLabel.entries()).map(([label, items]) => ({ label, items }));
  }, [puzzles]);

  if (isLoading) {
    return <div className="p-10 text-center text-text-secondary">{t("common.loading")}</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold text-text-primary">{t("folders.history")}</h1>

      {(!puzzles || puzzles.length === 0) && (
        <Card className="mt-6 text-center">
          <p className="mb-4 text-text-secondary">{t("folders.emptyHistory")}</p>
          <Link to="/generate">
            <Button>{t("generate.generateButton")}</Button>
          </Link>
        </Card>
      )}

      <div className="mt-6 space-y-8">
        {groups.map((group) => (
          <div key={group.label}>
            <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">{group.label}</h2>
            <PuzzleGrid puzzles={group.items ?? []} onAddToFolder={setPickerPuzzleId} />
          </div>
        ))}
      </div>

      <FolderPickerModal
        puzzleId={pickerPuzzleId}
        onClose={() => setPickerPuzzleId(null)}
      />
    </div>
  );
}

function FolderPickerModal({ puzzleId, onClose }: { puzzleId: string | null; onClose: () => void }) {
  const { data: folders } = useFolders();
  const addToFolders = useAddToFolders();
  const [selected, setSelected] = useState<string[]>([]);
  const all = [...(folders?.private ?? []), ...(folders?.public ?? [])];

  async function handleSave() {
    if (!puzzleId) return;
    try {
      await Promise.all(selected.map((folderId) => addToFolders.mutateAsync({ folderId, puzzleIds: [puzzleId] })));
      toast.success("Добавлено в папку");
      setSelected([]);
      onClose();
    } catch {
      toast.error("Не удалось добавить в папку");
    }
  }

  return (
    <Modal open={!!puzzleId} onOpenChange={(o) => !o && onClose()} title="Add to folder">
      <div className="max-h-60 space-y-1 overflow-y-auto">
        {all.map((folder) => (
          <label key={folder.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-elevated">
            <input
              type="checkbox"
              checked={selected.includes(folder.id)}
              onChange={(e) =>
                setSelected((s) => (e.target.checked ? [...s, folder.id] : s.filter((id) => id !== folder.id)))
              }
            />
            <span className="text-sm text-text-primary">{folder.name}</span>
          </label>
        ))}
      </div>
      <Button className="mt-4 w-full" onClick={() => void handleSave()} loading={addToFolders.isPending}>
        Добавить
      </Button>
    </Modal>
  );
}
