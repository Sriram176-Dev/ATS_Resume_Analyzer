import { Link } from "react-router-dom";
import { APP_NAME } from "../config";

export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="7" fill="var(--primary)" />
      <rect x="9" y="7" width="14" height="18" rx="2" fill="var(--primary-ink)" />
      <rect x="11.5" y="11" width="9" height="3" rx="1" fill="#FFE27A" />
      <rect x="11.5" y="16" width="9" height="1.6" rx=".8" fill="var(--primary)" opacity=".55" />
      <rect x="11.5" y="19.5" width="6" height="1.6" rx=".8" fill="var(--primary)" opacity=".55" />
    </svg>
  );
}

export default function Logo({ to = "/" }) {
  return (
    <Link to={to} className="logo" aria-label={`${APP_NAME} home`}>
      <LogoMark />
      <span>{APP_NAME}</span>
    </Link>
  );
}
