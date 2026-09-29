import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../../api/services";
import { useAuth } from "../../context/AuthContext";
import { getErrorMessage, getFieldErrors } from "../../lib/errors";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Field, PasswordField } from "../../components/ui/Field";
import Alert from "../../components/ui/Alert";
import "../auth.css";

export default function Login() {
  useDocumentTitle("Sign in");
  const { signIn, notice, clearNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address";
    if (!form.password) next.password = "Enter your password";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    clearNotice();
    if (!validate()) return;
    setBusy(true);
    try {
      const data = await authApi.login({ email: form.email.trim(), password: form.password });
      signIn(data);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err, "We couldn't sign you in. Please try again."));
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="panel auth-card">
        <h1>Welcome back</h1>
        <p className="auth-lede">Sign in to see your resume reports.</p>

        <form className="form-stack" onSubmit={onSubmit} noValidate>
          {(notice || formError) && <Alert tone={notice ? "warn" : "bad"}>{notice || formError}</Alert>}
          <Field label="Email" type="email" name="email" autoComplete="email" inputMode="email" value={form.email} onChange={update("email")} error={errors.email} autoFocus />
          <PasswordField name="password" autoComplete="current-password" value={form.password} onChange={update("password")} error={errors.password} />
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? "Signing in" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">New here? <Link to="/register">Create an account</Link></p>
      </div>
    </div>
  );
}
