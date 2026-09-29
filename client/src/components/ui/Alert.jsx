import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

const ICONS = { good: CheckCircle2, bad: AlertCircle, warn: TriangleAlert, neutral: Info };

export default function Alert({ tone = "bad", title, children, action, role }) {
  const Icon = ICONS[tone] || Info;
  return (
    <div className={`alert tone-${tone}`} role={role ?? (tone === "bad" ? "alert" : "status")}>
      <Icon size={18} aria-hidden="true" />
      <div>{title && <strong>{title} </strong>}{children}{action && <div style={{ marginTop: 8 }}>{action}</div>}</div>
    </div>
  );
}
