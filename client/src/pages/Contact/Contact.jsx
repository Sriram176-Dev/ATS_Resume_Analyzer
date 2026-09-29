import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Mail } from "lucide-react";
import { contactApi } from "../../api/services";
import { useAuth } from "../../context/AuthContext";
import { SUPPORT_EMAIL } from "../../config";
import { getErrorMessage, getFieldErrors } from "../../lib/errors";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Field } from "../../components/ui/Field";
import Alert from "../../components/ui/Alert";
import "./contact.css";

export default function Contact() {
  useDocumentTitle("Contact");
  const { user } = useAuth();
  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", message: "", website: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = "Enter your name";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address";
    if (form.message.trim().length < 10) next.message = "Your message should be at least 10 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    setBusy(true);
    try {
      await contactApi.send({ name: form.name.trim(), email: form.email.trim(), message: form.message.trim(), website: form.website });
      setSent(true);
    } catch (err) {
      setErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err, "We couldn't send your message. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page container contact">
      <div className="contact-intro">
        <h1>Get in touch</h1>
        <p>Found a bug, have a question about your score, or want to suggest an improvement? Send a message and we'll read it.</p>
        <p className="contact-mail"><Mail size={18} aria-hidden="true" /><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
      </div>

      <div className="panel panel-pad contact-form">
        {sent ? (
          <div className="contact-sent" role="status">
            <CheckCircle2 size={36} aria-hidden="true" />
            <h2>Message sent</h2>
            <p>Thanks for reaching out, {form.name.trim().split(/\s+/)[0]}. We'll get back to you at {form.email.trim()}.</p>
            <Link to={user ? "/dashboard" : "/"} className="btn btn-secondary">Back to {user ? "dashboard" : "home"}</Link>
          </div>
        ) : (
          <form className="form-stack" onSubmit={onSubmit} noValidate>
            {formError && <Alert>{formError}</Alert>}
            <Field label="Name" name="name" autoComplete="name" value={form.name} onChange={update("name")} error={errors.name} />
            <Field label="Email" type="email" name="email" autoComplete="email" inputMode="email" value={form.email} onChange={update("email")} error={errors.email} />
            <Field as="textarea" label="Message" name="message" rows={6} maxLength={4000} value={form.message} onChange={update("message")} error={errors.message} />
            {/* Honeypot: hidden from people, tempting to bots */}
            <div className="hp-field" aria-hidden="true">
              <label>Leave this empty<input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={update("website")} /></label>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={busy} style={{ alignSelf: "flex-start" }}>
              {busy && <span className="spinner" aria-hidden="true" />}
              {busy ? "Sending" : "Send message"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
