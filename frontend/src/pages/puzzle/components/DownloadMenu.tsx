import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { FileDown, Copy, ImageIcon } from "@/components/icons";
import { exportPuzzleUrl } from "@/features/puzzle/hooks";
import { toast } from "@/components/Toast";

interface DownloadMenuProps {
  puzzleId: string;
  fen: string;
  children: React.ReactNode;
}

/** Per docs/design-audit/toolboard.md section 3 ("download"): PGN / FEN / image. */
export function DownloadMenu({ puzzleId, fen, children }: DownloadMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="min-w-[200px] rounded-xl border border-border-subtle bg-bg-elevated p-1 shadow-xl"
        >
          <DropdownMenu.Item asChild>
            <a
              href={exportPuzzleUrl(puzzleId, "pgn")}
              download
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary outline-none hover:bg-bg-elevated-hover"
            >
              <FileDown className="h-4 w-4" /> Скачать PGN
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => {
              void navigator.clipboard.writeText(fen);
              toast.success("FEN скопирован");
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary outline-none hover:bg-bg-elevated-hover"
          >
            <Copy className="h-4 w-4" /> Скопировать FEN
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <a
              href={exportPuzzleUrl(puzzleId, "image")}
              download
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary outline-none hover:bg-bg-elevated-hover"
            >
              <ImageIcon className="h-4 w-4" /> Скачать изображение
            </a>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
