import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Plus, FileText, Hash, ImageIcon } from "@/components/icons";

export function AttachMenu({
  onAttachPgn,
  onAttachImage,
  onGenerateFromFen,
  fenLoading,
}: {
  onAttachPgn: (pgn: string) => void;
  onAttachImage: (file: File) => void;
  onGenerateFromFen: (fen: string) => void;
  fenLoading: boolean;
}) {
  const { t } = useTranslation();
  const [pgnOpen, setPgnOpen] = useState(false);
  const [fenOpen, setFenOpen] = useState(false);
  const [pgnInput, setPgnInput] = useState("");
  const [fenInput, setFenInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function submitPgn() {
    if (!pgnInput.trim()) return;
    onAttachPgn(pgnInput.trim());
    setPgnInput("");
    setPgnOpen(false);
  }

  function submitFen() {
    if (!fenInput.trim()) return;
    onGenerateFromFen(fenInput.trim());
    setFenInput("");
    setFenOpen(false);
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Прикрепить"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-none"
          >
            <Plus className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            side="top"
            sideOffset={8}
            className="min-w-[200px] rounded-xl border border-border-subtle bg-bg-elevated p-1 shadow-xl"
          >
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                setTimeout(() => setPgnOpen(true), 0);
              }}
              className={clsx(
                "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary outline-none hover:bg-bg-elevated-hover",
              )}
            >
              <FileText className="h-4 w-4" /> {t("generate.insertPgn")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                setTimeout(() => setFenOpen(true), 0);
              }}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary outline-none hover:bg-bg-elevated-hover"
            >
              <Hash className="h-4 w-4" /> {t("generate.insertFen")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                setTimeout(() => fileInputRef.current?.click(), 0);
              }}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary outline-none hover:bg-bg-elevated-hover"
            >
              <ImageIcon className="h-4 w-4" /> {t("generate.uploadImage")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAttachImage(file);
          e.target.value = "";
        }}
      />

      <Modal open={pgnOpen} onOpenChange={setPgnOpen} title={t("generate.pgnDialogTitle")}>
        <textarea
          className="h-32 w-full resize-none rounded-xl border border-border-subtle bg-bg-tertiary p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          placeholder={t("generate.pgnPastePlaceholder")}
          value={pgnInput}
          onChange={(e) => setPgnInput(e.target.value)}
        />
        <Button className="mt-4 w-full" onClick={submitPgn} disabled={!pgnInput.trim()}>
          {t("generate.apply")}
        </Button>
      </Modal>

      <Modal open={fenOpen} onOpenChange={setFenOpen} title={t("generate.fenDialogTitle")}>
        <textarea
          className="h-24 w-full resize-none rounded-xl border border-border-subtle bg-bg-tertiary p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          placeholder={t("generate.fenPastePlaceholder")}
          value={fenInput}
          onChange={(e) => setFenInput(e.target.value)}
        />
        <Button className="mt-4 w-full" onClick={submitFen} loading={fenLoading} disabled={!fenInput.trim()}>
          {t("generate.apply")}
        </Button>
      </Modal>
    </>
  );
}
