import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, Moon, Sun, X } from "lucide-react";
import Logo from "../Logo";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { firstName, initials } from "../../lib/format";
import "./layout.css";

export default function Navbar() {
  const { isAuthenticated, user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const links = [
    ...(isAuthenticated ? [{ to: "/dashboard", label: "Dashboard" }] : []),
    { to: "/contact", label: "Contact" },
  ];

  const handleSignOut = () => {
    close();
    signOut();
    navigate("/");
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Logo to={isAuthenticated ? "/dashboard" : "/"} />

        <nav className="navbar-links" id="site-menu" data-open={open} aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className="nav-link" onClick={close}>{l.label}</NavLink>
          ))}
          <div className="navbar-account">
            {isAuthenticated ? (
              <>
                {user && <span className="navbar-user" title={user.email}><span className="avatar" aria-hidden="true">{initials(user.name)}</span>{firstName(user.name)}</span>}
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleSignOut}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm" onClick={close}>Sign in</Link>
                <Link to="/register" className="btn btn-primary btn-sm" onClick={close}>Create account</Link>
              </>
            )}
          </div>
        </nav>

        <div className="navbar-tools">
          <button type="button" className="icon-btn" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
            {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          <button type="button" className="icon-btn navbar-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="site-menu" aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
