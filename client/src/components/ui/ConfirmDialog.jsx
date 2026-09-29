import { useEffect, useRef } from "react";

/** Accessible confirmation using the native <dialog> (focus trap, Esc to close, restores focus). */
export default function ConfirmDialog({ open, title, children, confirmLabel = "Confirm", busy = false, tone = "danger", onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="confirm-title" onClose={onCancel} onCancel={(e) => { if (busy) e.preventDefault(); }}>
      <div className="dialog-body">
        <h2 id="confirm-title">{title}</h2>
        <div>{children}</div>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={busy}>
          {busy && <span className="spinner" aria-hidden="true" />}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
