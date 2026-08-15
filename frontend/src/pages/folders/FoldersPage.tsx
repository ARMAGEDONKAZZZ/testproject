import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { Pill } from "@/components/Pill";
import { toast } from "@/components/Toast";
import { Plus, Lock, Globe, Trash, Share } from "@/components/icons";
import { PuzzleGrid } from "./components/PuzzleGrid";
import {
  useFolders,
  useFolderItems,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useShareFolder,
} from "@/features/folders/hooks";

export default function FoldersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { folderId } = useParams<{ folderId?: string }>();
  const { data: folders } = useFolders();
  const { data: items } = useFolderItems(folderId);
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const activeFolder = [...(folders?.private ?? []), ...(folders?.public ?? [])].find((f) => f.id === folderId);

  async function handleCreate(visibility: "private" | "public") {
    try {
      const folder = await createFolder.mutateAsync(visibility);
      setCreateOpen(false);
      navigate(`/folders/${folder.id}`);
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  }

  async function handleDelete() {
    if (!folderId) return;
    try {
      await deleteFolder.mutateAsync(folderId);
      setDeleteOpen(false);
      navigate("/folders");
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-6 py-10">
      <aside className="w-64 shrink-0">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">{t("folders.title")}</h2>
          <button onClick={() => setCreateOpen(true)} className="text-accent-green" aria-label={t("folders.createFolder")}>
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <FolderSection title={t("folders.privateFolders")} folders={folders?.private ?? []} activeId={folderId} icon={<Lock className="h-3 w-3" />} />
        <FolderSection title={t("folders.publicFolders")} folders={folders?.public ?? []} activeId={folderId} icon={<Globe className="h-3 w-3" />} />
      </aside>

      <main className="flex-1">
        {!activeFolder ? (
          <Card className="text-center text-text-secondary">Выберите папку слева или создайте новую</Card>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-xl font-bold text-text-primary">{activeFolder.name}</h1>
              <div className="flex gap-2">
                <Pill tone={activeFolder.visibility === "private" ? "neutral" : "green"}>
                  {activeFolder.visibility === "private" ? t("folders.private") : t("folders.public")}
                </Pill>
                <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                  Переименовать
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShareOpen(true)}>
                  <Share className="h-4 w-4" /> {t("puzzle.share")}
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {items && items.length > 0 ? (
              <PuzzleGrid puzzles={items} />
            ) : (
              <Card className="text-center text-text-secondary">{t("folders.emptyFolders")}</Card>
            )}
          </>
        )}
      </main>

      <Modal open={createOpen} onOpenChange={setCreateOpen} title={t("folders.createFolder")}>
        <p className="mb-3 text-sm text-text-secondary">Выберите уровень доступа</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => void handleCreate("private")}>
            <Lock className="h-4 w-4" /> {t("folders.private")}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => void handleCreate("public")}>
            <Globe className="h-4 w-4" /> {t("folders.public")}
          </Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onOpenChange={setDeleteOpen} title={t("folders.deleteConfirmTitle")}>
        <p className="mb-4 text-sm text-text-secondary">{t("folders.deleteConfirmBody")}</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" className="flex-1" loading={deleteFolder.isPending} onClick={() => void handleDelete()}>
            {t("common.delete")}
          </Button>
        </div>
      </Modal>

      {activeFolder && (
        <RenameModal
          open={addOpen}
          onOpenChange={setAddOpen}
          folderId={activeFolder.id}
          currentName={activeFolder.name}
          onSave={updateFolder}
        />
      )}

      {activeFolder && <ShareModal open={shareOpen} onOpenChange={setShareOpen} folderId={activeFolder.id} isPublic={activeFolder.visibility === "public"} />}
    </div>
  );
}

function FolderSection({
  title,
  folders,
  activeId,
  icon,
}: {
  title: string;
  folders: { id: string; name: string; itemCount: number }[];
  activeId?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <p className="mb-1 text-xs uppercase text-text-muted">{title}</p>
      <div className="space-y-0.5">
        {folders.map((f) => (
          <Link
            key={f.id}
            to={`/folders/${f.id}`}
            className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
              activeId === f.id ? "bg-bg-elevated text-text-primary" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {icon} {f.name}
            </span>
            <span className="text-text-muted">{f.itemCount}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RenameModal({
  open,
  onOpenChange,
  folderId,
  currentName,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folderId: string;
  currentName: string;
  onSave: ReturnType<typeof useUpdateFolder>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(currentName);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("folders.rename")}>
      <input
        className="w-full rounded-lg border border-border-subtle bg-bg-tertiary px-3 py-2 text-text-primary focus:outline-none"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        className="mt-4 w-full"
        loading={onSave.isPending}
        onClick={() => {
          onSave.mutate({ id: folderId, name });
          onOpenChange(false);
        }}
      >
        {t("common.save")}
      </Button>
    </Modal>
  );
}

function ShareModal({
  open,
  onOpenChange,
  folderId,
  isPublic,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folderId: string;
  isPublic: boolean;
}) {
  const { t } = useTranslation();
  const updateFolder = useUpdateFolder();
  const shareFolder = useShareFolder();
  const [password, setPassword] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGetLink() {
    try {
      if (!isPublic) {
        await updateFolder.mutateAsync({ id: folderId, visibility: "public" });
      }
      const res = await shareFolder.mutateAsync({ folderId, password: password || undefined });
      setShareUrl(res.shareUrl);
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("folders.shareTitle")}>
      <label className="mb-3 block text-sm text-text-secondary">
        {t("folders.setViewPassword")}
        <input
          type="password"
          className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-tertiary px-3 py-2 text-text-primary focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {shareUrl ? (
        <div className="flex gap-2">
          <input readOnly className="flex-1 rounded-lg border border-border-subtle bg-bg-tertiary px-3 py-2 text-sm text-text-secondary" value={shareUrl} />
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? t("common.copied") : t("common.copy")}
          </Button>
        </div>
      ) : (
        <Button className="w-full" loading={shareFolder.isPending} onClick={() => void handleGetLink()}>
          Получить ссылку
        </Button>
      )}
    </Modal>
  );
}
