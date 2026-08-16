import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { toast } from "@/components/Toast";
import { ApiError } from "@/api/client";
import { Lock, Globe, Copy, Send, MessageCircle, Mail } from "@/components/icons";
import { useCreateFolder, useAddToFolders, useShareFolder } from "@/features/folders/hooks";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  puzzleId: string;
}

/**
 * Per docs/design-audit/toolboard.md section 2 ("Share"): Private/Public +
 * optional view password + link + share-to icons. The real API
 * (contracts/rest-api.md POST /folders/:id/share) only issues links for
 * whole folders, not individual puzzles, so a single-puzzle "share" creates
 * a dedicated one-puzzle folder behind the scenes and shares that — same
 * user-visible result (FR-058–060), without inventing backend behavior
 * that doesn't exist.
 */
export function ShareModal({ open, onOpenChange, puzzleId }: ShareModalProps) {
  const createFolder = useCreateFolder();
  const addToFolders = useAddToFolders();
  const shareFolder = useShareFolder();

  const [visibility, setVisibility] = useState<"private" | "public">("public");
  const [password, setPassword] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  function reset() {
    setShareUrl(null);
    setPassword("");
    setCopied(false);
  }

  async function handleGetLink() {
    setLoading(true);
    try {
      const folder = await createFolder.mutateAsync(visibility);
      await addToFolders.mutateAsync({ folderId: folder.id, puzzleIds: [puzzleId] });
      const res = await shareFolder.mutateAsync({ folderId: folder.id, password: password || undefined });
      setShareUrl(res.shareUrl);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось создать ссылку");
    } finally {
      setLoading(false);
    }
  }

  const shareTargets = shareUrl
    ? [
        { icon: Send, label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}` },
        { icon: MessageCircle, label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(shareUrl)}` },
        {
          icon: null,
          glyph: "X",
          label: "X",
          href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`,
        },
        {
          icon: null,
          glyph: "f",
          label: "Facebook",
          href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
        },
        { icon: Mail, label: "Email", href: `mailto:?body=${encodeURIComponent(shareUrl)}` },
      ]
    : [];

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
      title="Поделиться"
    >
      {!shareUrl ? (
        <>
          <div className="mb-4 flex gap-3">
            <button
              type="button"
              onClick={() => setVisibility("private")}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl border p-3 ${
                visibility === "private" ? "border-accent-violet bg-accent-violet/10" : "border-border-subtle"
              }`}
            >
              <Lock className="h-4 w-4" />
              <span className="text-sm text-text-primary">Приватный</span>
              <span className="text-xs text-text-muted">Only you can access</span>
            </button>
            <button
              type="button"
              onClick={() => setVisibility("public")}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl border p-3 ${
                visibility === "public" ? "border-accent-violet bg-accent-violet/10" : "border-border-subtle"
              }`}
            >
              <Globe className="h-4 w-4" />
              <span className="text-sm text-text-primary">Публичный</span>
              <span className="text-xs text-text-muted">Anyone with the link</span>
            </button>
          </div>

          <label className="mb-4 block text-sm text-text-secondary">
            Установите пароль для просмотра (необязательно)
            <input
              type="password"
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-tertiary px-3 py-2 text-text-primary focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <Button className="w-full" loading={loading} onClick={() => void handleGetLink()}>
            Получить ссылку
          </Button>
        </>
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            <input
              readOnly
              className="flex-1 rounded-lg border border-border-subtle bg-bg-tertiary px-3 py-2 text-sm text-text-secondary"
              value={shareUrl}
            />
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              <Copy className="h-4 w-4" /> {copied ? "Copied!" : "Copy"}
            </Button>
          </div>

          <p className="mb-2 text-xs uppercase text-text-muted">Share to</p>
          <div className="flex gap-2">
            {shareTargets.map((target) => (
              <a
                key={target.label}
                href={target.href}
                target="_blank"
                rel="noopener noreferrer"
                title={target.label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-secondary transition-colors hover:border-accent-violet hover:text-accent-violet-light"
              >
                {target.icon ? <target.icon className="h-4 w-4" /> : <span className="text-sm font-bold">{target.glyph}</span>}
              </a>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
