import {
  List,
  Download,
  Share,
  Heart,
  Timer,
  Flip,
  Regenerate,
  FolderPlus,
  Bot,
  Lightbulb,
} from "@/components/icons";
import { DownloadMenu } from "./DownloadMenu";

interface ToolbarSidebarProps {
  puzzleId: string;
  fen: string;
  favorite: boolean;
  onToggleFavorite: () => void;
  onList: () => void;
  onShare: () => void;
  onTimer: () => void;
  onFlip: () => void;
  onRegenerate: () => void;
  regenerating?: boolean;
  onAddToFolder: () => void;
  onPlayVsAi: () => void;
  onHint: () => void;
}

function ToolButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-accent-green/20 text-accent-green" : "bg-bg-elevated text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

export function ToolbarSidebar(props: ToolbarSidebarProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <ToolButton onClick={props.onList} label="Список">
        <List className="h-4 w-4" />
      </ToolButton>
      <DownloadMenu puzzleId={props.puzzleId} fen={props.fen}>
        <button
          title="Скачать"
          aria-label="Скачать"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-elevated text-text-secondary transition-colors hover:text-text-primary"
        >
          <Download className="h-4 w-4" />
        </button>
      </DownloadMenu>
      <ToolButton onClick={props.onShare} label="Поделиться">
        <Share className="h-4 w-4" />
      </ToolButton>
      <ToolButton onClick={props.onToggleFavorite} active={props.favorite} label="Избранное">
        <Heart className="h-4 w-4" />
      </ToolButton>
      <ToolButton onClick={props.onTimer} label="Таймер">
        <Timer className="h-4 w-4" />
      </ToolButton>
      <ToolButton onClick={props.onFlip} label="Перевернуть доску">
        <Flip className="h-4 w-4" />
      </ToolButton>
      <ToolButton onClick={props.onRegenerate} disabled={props.regenerating} label="Перегенерировать">
        <Regenerate className={`h-4 w-4 ${props.regenerating ? "animate-spin" : ""}`} />
      </ToolButton>
      <ToolButton onClick={props.onAddToFolder} label="Добавить в папку">
        <FolderPlus className="h-4 w-4" />
      </ToolButton>
      <ToolButton onClick={props.onPlayVsAi} label="Играть против ИИ">
        <Bot className="h-4 w-4" />
      </ToolButton>
      <ToolButton onClick={props.onHint} label="Подсказка">
        <Lightbulb className="h-4 w-4" />
      </ToolButton>
    </div>
  );
}
