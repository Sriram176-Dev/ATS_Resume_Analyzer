import { Link } from "react-router-dom";
import Logo from "../Logo";
import { useAuth } from "../../context/AuthContext";
import { APP_NAME } from "../../config";
import "./layout.css";

export default function Footer() {
  const { isAuthenticated } = useAuth();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Logo to="/" />
          <p>Check how applicant tracking systems read your resume, and fix what they can't.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          {isAuthenticated ? <Link to="/dashboard">Dashboard</Link> : (<><Link to="/login">Sign in</Link><Link to="/register">Create account</Link></>)}
          <Link to="/contact">Contact</Link>
        </nav>
      </div>
      <div className="container footer-note">
        <p>&copy; {new Date().getFullYear()} {APP_NAME}. Scores are estimates based on common ATS behaviour and are not produced by any employer's system.</p>
      </div>
    </footer>
  );
}
