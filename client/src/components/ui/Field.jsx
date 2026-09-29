import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Labelled input with hint + error wiring (aria-describedby / aria-invalid). */
export function Field({ label, optional, hint, error, as = "input", className = "", children, ...props }) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const Control = as;
  return (
    <div className="field">
      <label htmlFor={id}>{label}{optional && <span className="label-optional"> (optional)</span>}</label>
      {children ? children({ id, describedBy, invalid: Boolean(error) }) : (
        <Control id={id} className={`${as === "textarea" ? "textarea" : "input"} ${className}`} aria-invalid={error ? "true" : undefined} aria-describedby={describedBy} {...props} />
      )}
      {hint && !error && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function PasswordField({ label = "Password", hint, error, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="input-wrap">
          <input id={id} className="input" type={visible ? "text" : "password"} aria-invalid={invalid ? "true" : undefined} aria-describedby={describedBy} {...props} />
          <button type="button" className="icon-btn" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>
            {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
      )}
    </Field>
  );
}
