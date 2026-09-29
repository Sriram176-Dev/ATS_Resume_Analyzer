import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { authApi } from "../../api/services";
import { useAuth } from "../../context/AuthContext";
import { getErrorMessage, getFieldErrors } from "../../lib/errors";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Field, PasswordField } from "../../components/ui/Field";
import Alert from "../../components/ui/Alert";
import "../auth.css";

const RULES = [
  { id: "len", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "letter", label: "One letter", test: (p) => /[A-Za-z]/.test(p) },
  { id: "digit", label: "One number", test: (p) => /\d/.test(p) },
];

export default function Register() {
  useDocumentTitle("Create account");
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = "Enter your name (at least 2 characters)";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address";
    if (!RULES.every((r) => r.test(form.password))) next.password = "Your password doesn't meet all the requirements yet";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    setBusy(true);
    try {
      const data = await authApi.register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      signIn(data); // the API returns a session, so there's no second sign-in step
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err, "We couldn't create your account. Please try again."));
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="panel auth-card">
        <h1>Create your account</h1>
        <p className="auth-lede">Save your analyses and track your score as you improve your resume.</p>

        <form className="form-stack" onSubmit={onSubmit} noValidate>
          {formError && <Alert>{formError}</Alert>}
          <Field label="Full name" name="name" autoComplete="name" value={form.name} onChange={update("name")} error={errors.name} autoFocus />
          <Field label="Email" type="email" name="email" autoComplete="email" inputMode="email" value={form.email} onChange={update("email")} error={errors.email} />
          <div>
            <PasswordField name="password" autoComplete="new-password" value={form.password} onChange={update("password")} error={errors.password} />
            <ul className="rules" aria-label="Password requirements">
              {RULES.map((r) => {
                const met = r.test(form.password);
                return (
                  <li key={r.id} data-met={met}>
                    <span className="dot" aria-hidden="true">{met && <Check size={10} strokeWidth={3} />}</span>
                    {r.label}<span className="sr-only">{met ? " (met)" : " (not met yet)"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? "Creating account" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
