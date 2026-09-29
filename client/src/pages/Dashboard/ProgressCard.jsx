import { TrendingDown, TrendingUp } from "lucide-react";
import Sparkline from "../../components/ui/Sparkline";
import { scoreBand } from "../../lib/score";

export default function ProgressCard({ stats, loading, error }) {
  if (loading) {
    return (
      <section className="panel panel-pad" aria-busy="true" aria-label="Your progress">
        <div className="skeleton" style={{ height: 22, width: 140 }} />
        <div className="skeleton" style={{ height: 64, width: 96, marginTop: 20 }} />
        <div className="skeleton" style={{ height: 56, marginTop: 20 }} />
      </section>
    );
  }

  if (error || !stats || stats.count === 0 || stats.latest == null) {
    return (
      <section className="panel panel-pad" aria-label="Your progress">
        <div className="panel-head"><h2 className="panel-title">Your progress</h2></div>
        <p className="muted">{error ? "We couldn't load your stats right now." : "Your latest score, best score and trend will show up here after your first analysis."}</p>
      </section>
    );
  }

  const band = scoreBand(stats.latest);
  const up = stats.change > 0;

  return (
    <section className="panel panel-pad" aria-label="Your progress">
      <div className="panel-head"><h2 className="panel-title">Your progress</h2></div>

      <p className="hint">Latest score</p>
      <div className="latest">
        <span className={`latest-number tone-${band.tone}`}>{stats.latest}</span>
        <span className="latest-band">{band.label}</span>
        {stats.change !== null && stats.change !== 0 && (
          <span className={`change ${up ? "tone-good" : "tone-bad"}`}>
            {up ? <TrendingUp size={14} aria-hidden="true" /> : <TrendingDown size={14} aria-hidden="true" />}
            {up ? "+" : ""}{stats.change}<span className="sr-only"> points since your previous analysis</span>
          </span>
        )}
      </div>

      {stats.trend.length > 1 && <div className="trend"><Sparkline values={stats.trend.map((t) => t.score)} /></div>}

      <dl className="stat-list">
        <div><dt>Best</dt><dd>{stats.best}</dd></div>
        <div><dt>Average</dt><dd>{stats.average}</dd></div>
        <div><dt>Analyses</dt><dd>{stats.count}</dd></div>
      </dl>
    </section>
  );
}
