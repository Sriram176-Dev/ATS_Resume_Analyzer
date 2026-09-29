import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, UploadCloud, X } from "lucide-react";
import { getPublicConfig, resumesApi } from "../../api/services";
import { DEFAULT_MAX_UPLOAD_MB, MAX_JOB_DESCRIPTION_CHARS } from "../../config";
import { validateResumeFile } from "../../lib/files";
import { formatFileSize } from "../../lib/format";
import { getErrorMessage } from "../../lib/errors";
import { Field } from "../../components/ui/Field";
import Alert from "../../components/ui/Alert";

export default function UploadCard() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [config, setConfig] = useState({ aiEnabled: false, maxUploadMb: DEFAULT_MAX_UPLOAD_MB });
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => { getPublicConfig().then(setConfig); }, []);

  const chooseFile = (candidate) => {
    const problem = validateResumeFile(candidate, config.maxUploadMb);
    setError(problem);
    setFile(problem ? null : candidate);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    if (e.dataTransfer.files?.length > 1) return setError("Upload one resume at a time.");
    if (e.dataTransfer.files?.[0]) chooseFile(e.dataTransfer.files[0]);
  };

  const clearFile = () => {
    setFile(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const problem = validateResumeFile(file, config.maxUploadMb);
    if (problem) return setError(problem);
    setError("");
    setBusy(true);
    setProgress(0);
    try {
      const result = await resumesApi.analyze({ file, jobDescription: jobDescription.trim(), label: label.trim() }, (p) => setProgress(Math.round((p.progress || 0) * 100)));
      navigate(`/reports/${result.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "We couldn't analyze that resume. Please try again."));
      setBusy(false);
    }
  };

  const analyzing = busy && progress >= 100;

  return (
    <form className="panel panel-pad upload" onSubmit={onSubmit} noValidate>
      <div className="panel-head"><h2 className="panel-title">New analysis</h2></div>

      <div className="form-stack">
        {error && <Alert>{error}</Alert>}

        {file ? (
          <div className="file-row">
            <span className="file-icon" aria-hidden="true"><FileText size={20} /></span>
            <div className="file-meta">
              <span className="file-name">{file.name}</span>
              <span className="hint">{formatFileSize(file.size)}</span>
            </div>
            <button type="button" className="icon-btn" onClick={clearFile} disabled={busy} aria-label={`Remove ${file.name}`}><X size={18} aria-hidden="true" /></button>
          </div>
        ) : (
          <label className={`dropzone${dragging ? " is-dragging" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            <input ref={inputRef} type="file" className="sr-only" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => e.target.files?.[0] && chooseFile(e.target.files[0])} />
            <UploadCloud size={28} aria-hidden="true" />
            <span className="dropzone-title">Drop your resume here, or <span className="dropzone-link">browse files</span></span>
            <span className="hint">PDF or Word (.docx), up to {config.maxUploadMb} MB</span>
          </label>
        )}

        <Field label="Target role" optional name="label" maxLength={100} placeholder="e.g. Frontend Engineer at Acme" value={label} onChange={(e) => setLabel(e.target.value)} disabled={busy} hint="A short name that helps you tell your analyses apart." />

        <Field
          as="textarea" label="Job description" optional name="jobDescription" rows={6} maxLength={MAX_JOB_DESCRIPTION_CHARS} disabled={busy}
          placeholder="Paste the job posting here to see which of its keywords your resume is missing."
          value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}
          hint={`${jobDescription.length.toLocaleString()} / ${MAX_JOB_DESCRIPTION_CHARS.toLocaleString()}. Without one, we check general ATS best practices.`}
        />

        {busy && (
          <div aria-live="polite">
            <div className="bar" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={analyzing ? undefined : progress}>
              <span className={analyzing ? "bar-indeterminate" : ""} style={{ "--value": analyzing ? "40%" : `${progress}%` }} />
            </div>
            <p className="hint" style={{ marginTop: 6 }}>{analyzing ? "Reading your resume and running checks. This can take up to 30 seconds." : `Uploading ${progress}%`}</p>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !file}>
          {busy && <span className="spinner" aria-hidden="true" />}
          {busy ? "Analyzing" : "Analyze resume"}
        </button>

        <p className="hint">
          Your resume is stored in your account and can be deleted at any time.
          {config.aiEnabled && " Its text is also sent to Google's Gemini API to generate suggestions."}
        </p>
      </div>
    </form>
  );
}
