import { useEffect, useId, useRef } from 'react';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { X } from 'lucide-react';

function isBackdrop(event: MouseEvent<HTMLDialogElement> | PointerEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const bounds = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  );
}

export function Modal({
  title,
  onClose,
  children,
  className = '',
  dismissible = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onPointerDown={(event) => {
        backdropPress.current = event.button === 0 && event.isPrimary && isBackdrop(event);
      }}
      onPointerCancel={() => {
        backdropPress.current = false;
      }}
      onClick={(event) => {
        // Native pickers can return a click targeted at the dialog. Only dismiss
        // an intentional backdrop press, never a click returning from a control.
        const startedOnBackdrop = backdropPress.current;
        backdropPress.current = false;
        if (dismissible && startedOnBackdrop && event.detail > 0 && isBackdrop(event)) onClose();
      }}
    >
      <div className="modal-inner">
        {dismissible && (
          <button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        )}
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
