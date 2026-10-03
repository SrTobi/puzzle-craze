import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`sudoku-dialog${wide ? ' is-wide' : ''}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sudoku-dialog-content">
        <button className="sudoku-close" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
        <p className="sudoku-eyebrow">A LITTLE ROOM TO EXPLORE</p>
        <h2 id={id}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
