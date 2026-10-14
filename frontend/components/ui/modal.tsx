"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export default function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      aria-label={title}
      className="max-h-[90vh] w-[min(640px,calc(100%-32px))] rounded-2xl bg-ivory p-6 text-ink shadow-2xl backdrop:bg-ink/35"
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-serif text-2xl">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded-full p-2 hover:bg-ink/5"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
