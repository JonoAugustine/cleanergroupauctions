import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

type Props = { labelledBy: string; onCancel: () => void; class?: string; children: ComponentChildren };

/** Native modal dialog: focus stays inside and Escape asks onCancel, which may refuse while busy. */
export function Modal({ labelledBy, onCancel, class: cls = '', children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      class={`modal ${cls}`}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      {children}
    </dialog>
  );
}
