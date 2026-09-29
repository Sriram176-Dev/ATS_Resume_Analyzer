import { Link } from "react-router-dom";
import { Download, FileText, Trash2 } from "lucide-react";
import { formatDate } from "../../lib/format";
import { scoreBand } from "../../lib/score";

function ScorePill({ score }) {
  const { label, tone } = scoreBand(score);
  return <span className={`score-pill tone-${tone}`}><strong>{score}</strong><span>{label}</span></span>;
}

export default function HistoryList({ items, onDownload, onDelete, downloadingId }) {
  return (
    <ul className="history" aria-label="Past analyses">
      <li className="history-head" aria-hidden="true">
        <span>Resume</span><span>Target</span><span>Score</span><span>Analyzed</span><span />
      </li>
      {items.map((r) => (
        <li key={r.id} className="history-row">
          <div className="hr-main">
            <span className="file-icon" aria-hidden="true"><FileText size={18} /></span>
            <div className="hr-text">
              <Link to={`/reports/${r.id}`} className="hr-title">{r.fileName}</Link>
              {r.label && <span className="hr-sub">{r.label}</span>}
            </div>
          </div>
          <span className="hr-target">{r.hasJobDescription ? "Job description" : "General check"}</span>
          <span className="hr-score"><ScorePill score={r.atsScore} /></span>
          <span className="hr-date">{formatDate(r.createdAt)}</span>
          <span className="hr-actions">
            <button type="button" className="icon-btn" onClick={() => onDownload(r)} disabled={downloadingId === r.id} aria-label={`Download PDF report for ${r.fileName}`}>
              {downloadingId === r.id ? <span className="spinner" aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
            </button>
            <button type="button" className="icon-btn icon-btn-danger" onClick={() => onDelete(r)} aria-label={`Delete ${r.fileName}`}>
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
