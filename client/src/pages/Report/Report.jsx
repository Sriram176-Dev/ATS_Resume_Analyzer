import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Download, FileQuestion, Sparkles, Trash2, TriangleAlert, XCircle } from "lucide-react";
import { resumesApi } from "../../api/services";
import { useToast } from "../../context/ToastContext";
import { formatDate, plural } from "../../lib/format";
import { getErrorMessage } from "../../lib/errors";
import { KEYWORD_GROUPS, SECTION_LABELS, categoryLabel, scoreBand } from "../../lib/score";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import ScoreRing from "../../components/ui/ScoreRing";
import Alert from "../../components/ui/Alert";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import "./report.css";

const PRIORITIES = ["high", "medium", "low"];
const PRIORITY_TONE = { high: "bad", medium: "warn", low: "good" };
const STATUS_ICON = { pass: CheckCircle2, warn: TriangleAlert, fail: XCircle };
const STATUS_TONE = { pass: "good", warn: "warn", fail: "bad" };
const STATUS_TEXT = { pass: "Passed", warn: "Needs attention", fail: "Failed" };
const EXPECTED_SECTIONS = ["summary", "experience", "education", "skills"];

function verdict(r) {
  const high = r.suggestions.filter((s) => s.priority === "high").length;
  if (r.atsScore >= 85) return "Your resume is in strong shape for ATS screening. What's left is polish.";
  if (r.atsScore >= 70) return high ? `A solid base. Fixing ${plural(high, "high-priority item")} will lift your score the most.` : "A solid base, with a few small improvements available.";
  if (r.atsScore >= 50) return high ? `This needs some work. Start with the ${plural(high, "high-priority fix", "high-priority fixes")} below.` : "This needs some work. See the recommendations below.";
  return "Parsers are likely to struggle with this resume. Start with the high-priority fixes below.";
}

function SubScore({ label, description, value }) {
  const na = value == null;
  const tone = na ? "neutral" : scoreBand(value).tone;
  return (
    <div className={`subscore tone-${tone}`}>
      <div className="subscore-top">
        <span className="subscore-label">{label}</span>
        <span className="subscore-value">{na ? "Not scored" : value}</span>
      </div>
      <div className="bar" aria-hidden="true"><span style={{ "--value": na ? "0%" : `${value}%` }} /></div>
      <p className="hint">{description}</p>
    </div>
  );
}

function Recommendations({ suggestions, aiStatus }) {
  const [filter, setFilter] = useState("all");
  const counts = useMemo(() => Object.fromEntries(PRIORITIES.map((p) => [p, suggestions.filter((s) => s.priority === p).length])), [suggestions]);
  const shown = filter === "all" ? suggestions : suggestions.filter((s) => s.priority === filter);

  return (
    <section id="recommendations" className="panel panel-pad report-section" aria-labelledby="rec-title">
      <div className="panel-head">
        <h2 id="rec-title" className="panel-title">Recommendations</h2>
        <div className="filters" role="group" aria-label="Filter by priority">
          <button type="button" className="filter-btn" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All <span className="filter-count">{suggestions.length}</span></button>
          {PRIORITIES.map((p) => counts[p] > 0 && (
            <button key={p} type="button" className="filter-btn" aria-pressed={filter === p} onClick={() => setFilter(p)}>
              {p[0].toUpperCase() + p.slice(1)} <span className="filter-count">{counts[p]}</span>
            </button>
          ))}
        </div>
      </div>

      {aiStatus === "unavailable" && <Alert tone="warn">AI suggestions were unavailable for this analysis, so these recommendations come from our built-in checks.</Alert>}

      {suggestions.length === 0 ? (
        <p className="muted">Nothing to fix. Every check passed.</p>
      ) : (
        <ol className="recs">
          {shown.map((s, i) => (
            <li key={`${s.text}-${i}`} className={`rec tone-${PRIORITY_TONE[s.priority]}`}>
              <div className="rec-meta">
                <span className="badge">{s.priority[0].toUpperCase() + s.priority.slice(1)} priority</span>
                <span className="rec-cat">{categoryLabel(s.category)}</span>
                {s.source === "ai" && <span className="rec-ai"><Sparkles size={13} aria-hidden="true" />AI</span>}
              </div>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Checks({ checks, sections }) {
  const scored = checks.filter((c) => c.category !== "keywords");
  const passed = scored.filter((c) => c.status === "pass").length;
  const groups = [{ key: "format", title: "Format and structure" }, { key: "content", title: "Content quality" }];

  return (
    <section id="checks" className="panel panel-pad report-section" aria-labelledby="checks-title">
      <div className="panel-head">
        <h2 id="checks-title" className="panel-title">ATS checks</h2>
        <span className="muted">{passed} of {scored.length} passed</span>
      </div>

      {(
        <div className="sections-found">
          <p className="label">Sections detected</p>
          <ul className="chip-list">
            {EXPECTED_SECTIONS.concat(sections.filter((s) => !EXPECTED_SECTIONS.includes(s))).map((s) => {
              const found = sections.includes(s);
              return <li key={s} className={`chip ${found ? "chip-found" : "chip-missing"}`}>{SECTION_LABELS[s] || s}<span className="sr-only">{found ? " (found)" : " (not found)"}</span></li>;
            })}
          </ul>
        </div>
      )}

      {groups.map((g) => {
        const items = scored.filter((c) => c.category === g.key);
        if (!items.length) return null;
        return (
          <div key={g.key} className="check-group">
            <h3 className="check-group-title">{g.title}</h3>
            <ul className="checks">
              {items.map((c) => {
                const Icon = STATUS_ICON[c.status];
                return (
                  <li key={c.id} className={`check tone-${STATUS_TONE[c.status]}`}>
                    <Icon size={20} aria-hidden="true" />
                    <div className="check-body">
                      <span className="check-label">{c.label}<span className="sr-only">: {STATUS_TEXT[c.status]}</span></span>
                      <span className="check-detail">{c.detail}</span>
                    </div>
                    <span className="check-points" aria-label={`${c.points} of ${c.maxPoints} points`}>{Math.round(c.points)}/{c.maxPoints}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function Keywords({ r }) {
  const details = r.keywordDetails || [];
  const hasDetails = details.length > 0;
  const legacy = !hasDetails && (r.matchedKeywords.length + r.missingKeywords.length > 0);

  return (
    <section id="keywords" className="panel panel-pad report-section" aria-labelledby="kw-title">
      <div className="panel-head">
        <h2 id="kw-title" className="panel-title">Keyword match</h2>
        {r.hasJobDescription && (hasDetails || legacy) && <span className="muted">{r.matchedKeywords.length} of {r.matchedKeywords.length + r.missingKeywords.length} found</span>}
      </div>

      {!r.hasJobDescription && (
        <div className="kw-empty">
          <p>You ran a general check, so there's nothing to match keywords against. Add a job description to see which of its skills and terms your resume is missing.</p>
          <Link to="/dashboard" className="btn btn-secondary">Analyze against a job description</Link>
        </div>
      )}

      {r.hasJobDescription && !hasDetails && !legacy && <p className="muted">We couldn't find recognizable skills or terms in that job description. Try pasting the full posting, including its requirements.</p>}

      {r.hasJobDescription && hasDetails && KEYWORD_GROUPS.map((g) => {
        const items = details.filter((d) => d.category === g.key);
        if (!items.length) return null;
        return (
          <div key={g.key} className="kw-group">
            <h3 className="check-group-title">{g.label}</h3>
            <ul className="chip-list">
              {items.map((k) => (
                <li key={k.term} className={`chip ${k.matched ? "chip-found" : "chip-missing"}`}>{k.term}<span className="sr-only">{k.matched ? " (found)" : " (missing)"}</span></li>
              ))}
            </ul>
          </div>
        );
      })}

      {legacy && (
        <>
          <div className="kw-group"><h3 className="check-group-title">Found</h3><ul className="chip-list">{r.matchedKeywords.map((k) => <li key={k} className="chip chip-found">{k}</li>)}</ul></div>
          <div className="kw-group"><h3 className="check-group-title">Missing</h3><ul className="chip-list">{r.missingKeywords.map((k) => <li key={k} className="chip chip-missing">{k}</li>)}</ul></div>
        </>
      )}

      {r.hasJobDescription && (
        <details className="jd-details">
          <summary>Job description used</summary>
          <p>{r.jobDescription}</p>
        </details>
      )}
    </section>
  );
}

export default function Report() {
  const { id } = useParams();
  // Keying by id gives each report a fresh state (no stale data when navigating between reports).
  return <ReportView key={id} id={id} />;
}

function ReportView({ id }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | notfound | error
  const [downloading, setDownloading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useDocumentTitle(report ? `Report: ${report.fileName}` : "Report");

  const load = useCallback(() => {
    resumesApi.get(id)
      .then((data) => { setReport(data); setState("ready"); })
      .catch((err) => setState(err.response?.status === 404 || err.response?.status === 400 ? "notfound" : "error"));
  }, [id]);

  const retry = () => { setState("loading"); load(); };

  useEffect(load, [load]);

  const download = async () => {
    setDownloading(true);
    try { await resumesApi.downloadReport(id, report.fileName); }
    catch (err) { toast.error(getErrorMessage(err, "Couldn't download the report.")); }
    finally { setDownloading(false); }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await resumesApi.remove(id);
      toast.success("Analysis deleted");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't delete that analysis."));
      setDeleting(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="page container" aria-busy="true" aria-label="Loading report">
        <div className="skeleton" style={{ height: 20, width: 120, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 40, width: "50%", marginBottom: 28 }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  if (state === "notfound" || state === "error") {
    return (
      <div className="page container">
        <div className="panel empty">
          <div className="empty-icon"><FileQuestion size={22} aria-hidden="true" /></div>
          <h3>{state === "notfound" ? "We couldn't find that report" : "We couldn't load this report"}</h3>
          <p>{state === "notfound" ? "It may have been deleted, or the link may be wrong." : "Something went wrong on our side. Please try again."}</p>
          {state === "error" ? <button type="button" className="btn btn-primary" onClick={retry}>Try again</button> : <Link to="/dashboard" className="btn btn-primary">Back to dashboard</Link>}
        </div>
      </div>
    );
  }

  const r = report;
  const band = scoreBand(r.atsScore);
  const metaBits = [
    `Analyzed ${formatDate(r.createdAt)}`,
    r.label || (r.hasJobDescription ? "Job description provided" : "General check"),
    r.stats?.pageCount ? plural(r.stats.pageCount, "page") : null,
    r.stats?.wordCount ? `${r.stats.wordCount.toLocaleString()} words` : null,
  ].filter(Boolean);

  return (
    <div className="page container report">
      <Link to="/dashboard" className="back-link"><ArrowLeft size={16} aria-hidden="true" />Dashboard</Link>

      <header className="report-header">
        <div className="report-title">
          <h1>{r.fileName}</h1>
          <ul className="meta-list">{metaBits.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
        <div className="report-actions">
          <button type="button" className="btn btn-secondary" onClick={download} disabled={downloading}>
            {downloading ? <span className="spinner" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}Download PDF
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmOpen(true)}><Trash2 size={16} aria-hidden="true" />Delete</button>
        </div>
      </header>

      <section className="panel summary" aria-label="Score summary">
        <div className="summary-score">
          <ScoreRing score={r.atsScore} size={168} stroke={12} />
        </div>
        <div className="summary-body">
          <h2>{band.label}: {r.atsScore} out of 100</h2>
          <p className="summary-verdict">{verdict(r)}</p>
          <div className="subscores">
            <SubScore label="Format" value={r.formatScore} description="Can software read and structure it?" />
            <SubScore label="Content" value={r.contentScore} description="Are the bullets specific and quantified?" />
            <SubScore label="Keywords" value={r.keywordScore} description={r.keywordScore == null ? "Add a job description to score this." : "Coverage of the job description."} />
          </div>
        </div>
      </section>

      <nav className="report-nav" aria-label="Report sections">
        <a href="#recommendations">Recommendations</a>
        <a href="#checks">ATS checks</a>
        <a href="#keywords">Keywords</a>
      </nav>

      <Recommendations suggestions={r.suggestions} aiStatus={r.aiStatus} />
      <Checks checks={r.checks} sections={r.sections} />
      <Keywords r={r} />

      <ConfirmDialog open={confirmOpen} title="Delete this analysis?" confirmLabel="Delete" busy={deleting} onConfirm={remove} onCancel={() => !deleting && setConfirmOpen(false)}>
        <p><strong>{r.fileName}</strong> and its report will be permanently removed. This can't be undone.</p>
      </ConfirmDialog>
    </div>
  );
}
