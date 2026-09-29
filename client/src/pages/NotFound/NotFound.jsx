import { Link } from "react-router-dom";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useAuth } from "../../context/AuthContext";

export default function NotFound() {
  useDocumentTitle("Page not found");
  const { isAuthenticated } = useAuth();
  return (
    <div className="page container" style={{ textAlign: "center", paddingBlock: "96px" }}>
      <p className="hint" style={{ fontSize: "var(--text-base)" }}>Error 404</p>
      <h1 style={{ marginTop: 8 }}>This page doesn't exist</h1>
      <p style={{ color: "var(--muted)", margin: "12px auto 28px", maxWidth: "44ch" }}>The link may be broken, or the page may have moved.</p>
      <Link to={isAuthenticated ? "/dashboard" : "/"} className="btn btn-primary">{isAuthenticated ? "Go to dashboard" : "Go to home"}</Link>
    </div>
  );
}
