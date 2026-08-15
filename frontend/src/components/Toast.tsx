import * as ToastPrimitive from "@radix-ui/react-toast";
import { create } from "zustand";

type ToastTone = "default" | "success" | "error";

interface ToastItem {
  id: number;
  title: string;
  tone: ToastTone;
}

interface ToastState {
  items: ToastItem[];
  push: (title: string, tone?: ToastTone) => void;
  remove: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (title, tone = "default") =>
    set((s) => ({ items: [...s.items, { id: nextId++, title, tone }] })),
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export const toast = {
  show: (title: string) => useToastStore.getState().push(title, "default"),
  success: (title: string) => useToastStore.getState().push(title, "success"),
  error: (title: string) => useToastStore.getState().push(title, "error"),
};

const toneClasses: Record<ToastTone, string> = {
  default: "border-border-subtle bg-bg-elevated text-text-primary",
  success: "border-accent-green/40 bg-bg-elevated text-accent-green",
  error: "border-danger/40 bg-bg-elevated text-danger",
};

export function ToastViewport() {
  const items = useToastStore((s) => s.items);
  const remove = useToastStore((s) => s.remove);

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {items.map((item) => (
        <ToastPrimitive.Root
          key={item.id}
          duration={4000}
          onOpenChange={(open) => !open && remove(item.id)}
          className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClasses[item.tone]}`}
        >
          <ToastPrimitive.Description>{item.title}</ToastPrimitive.Description>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-[360px] max-w-[90vw] flex-col gap-2" />
    </ToastPrimitive.Provider>
  );
}
