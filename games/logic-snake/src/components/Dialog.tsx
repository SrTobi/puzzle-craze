import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
export function Dialog({
  title,
  onClose,
  children,
  initialFocus,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    if (initialFocus?.current) {
      initialFocus.current.focus({ preventScroll: true });
      initialFocus.current.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    return () => dialog.close();
  }, [initialFocus]);
  return (
    <dialog
      ref={ref}
      className="snake-dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="snake-dialog-inner">
        <button
          className="snake-icon-button dialog-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <h2 id={id}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
