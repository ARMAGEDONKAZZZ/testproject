import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@/components/icons";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

/** Accessible modal (focus trap, Esc-to-close, labelled) built on Radix Dialog. */
export function Modal({ open, onOpenChange, title, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-subtle bg-bg-secondary p-6 shadow-2xl focus:outline-none">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-text-primary">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Закрыть"
                className="rounded-lg p-1 text-text-secondary hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
