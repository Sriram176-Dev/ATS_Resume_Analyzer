import { useCallback, useEffect, useState } from "react";
import { FileSearch } from "lucide-react";
import { resumesApi } from "../../api/services";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { firstName } from "../../lib/format";
import { getErrorMessage } from "../../lib/errors";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import Alert from "../../components/ui/Alert";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import UploadCard from "./UploadCard";
import ProgressCard from "./ProgressCard";
import HistoryList from "./HistoryList";
import "./dashboard.css";

const PAGE_SIZE = 10;

export default function Dashboard() {
  useDocumentTitle("Dashboard");
  const { user } = useAuth();
  const toast = useToast();

  const [stats, setStats] = useState(null);
  const [statsState, setStatsState] = useState("loading");
  const [history, setHistory] = useState({ items: [], page: 0, hasMore: false, total: 0 });
  const [historyState, setHistoryState] = useState("loading"); // loading | ready | error
  const [loadingMore, setLoadingMore] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const loadStats = useCallback(() => {
    resumesApi.stats().then((s) => { setStats(s); setStatsState("ready"); }).catch(() => setStatsState("error"));
  }, []);

  const loadHistory = useCallback((page = 1) => (
    resumesApi.list({ page, limit: PAGE_SIZE })
      .then((data) => {
        setHistory((h) => ({ items: page === 1 ? data.items : [...h.items, ...data.items], page, hasMore: data.hasMore, total: data.total }));
        setHistoryState("ready");
      })
      .catch((err) => {
        if (page === 1) setHistoryState("error");
        else toast.error(getErrorMessage(err, "Couldn't load more analyses."));
      })
  ), [toast]);

  useEffect(() => { loadStats(); loadHistory(1); }, [loadStats, loadHistory]);

  const retry = () => { setHistoryState("loading"); setStatsState("loading"); loadStats(); loadHistory(1); };

  const loadMore = async () => { setLoadingMore(true); await loadHistory(history.page + 1); setLoadingMore(false); };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await resumesApi.remove(toDelete.id);
      setHistory((h) => ({ ...h, items: h.items.filter((r) => r.id !== toDelete.id), total: h.total - 1 }));
      toast.success("Analysis deleted");
      setToDelete(null);
      loadStats();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't delete that analysis."));
    } finally {
      setDeleting(false);
    }
  };

  const download = async (r) => {
    setDownloadingId(r.id);
    try { await resumesApi.downloadReport(r.id, r.fileName); }
    catch (err) { toast.error(getErrorMessage(err, "Couldn't download the report.")); }
    finally { setDownloadingId(null); }
  };

  return (
    <div className="page container">
      <header className="page-header">
        <h1>Hi, {firstName(user?.name)}</h1>
        <p>Upload a resume to see how it scores, what an ATS can and can't read, and what to fix first.</p>
      </header>

      <div className="dash-grid">
        <UploadCard />
        <ProgressCard stats={stats} loading={statsState === "loading"} error={statsState === "error"} />
      </div>

      <section className="history-section" aria-labelledby="history-title">
        <div className="panel-head">
          <h2 id="history-title" className="panel-title">Past analyses{historyState === "ready" && history.total > 0 && <span className="muted"> ({history.total})</span>}</h2>
        </div>

        {historyState === "loading" && (
          <div className="panel panel-pad" aria-busy="true" aria-label="Loading analyses">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 48, marginBottom: i < 2 ? 12 : 0 }} />)}
          </div>
        )}

        {historyState === "error" && (
          <Alert action={<button type="button" className="btn btn-secondary btn-sm" onClick={retry}>Try again</button>}>We couldn't load your analyses.</Alert>
        )}

        {historyState === "ready" && history.items.length === 0 && (
          <div className="panel empty">
            <div className="empty-icon"><FileSearch size={22} aria-hidden="true" /></div>
            <h3>No analyses yet</h3>
            <p>Upload your resume above. Your reports are saved here so you can compare versions as you improve it.</p>
          </div>
        )}

        {historyState === "ready" && history.items.length > 0 && (
          <div className="panel">
            <HistoryList items={history.items} onDownload={download} onDelete={setToDelete} downloadingId={downloadingId} />
            {history.hasMore && (
              <div className="load-more">
                <button type="button" className="btn btn-secondary" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore && <span className="spinner" aria-hidden="true" />}Show more
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <ConfirmDialog open={Boolean(toDelete)} title="Delete this analysis?" confirmLabel="Delete" busy={deleting} onConfirm={confirmDelete} onCancel={() => !deleting && setToDelete(null)}>
        <p><strong>{toDelete?.fileName}</strong> and its report will be permanently removed. This can't be undone.</p>
      </ConfirmDialog>
    </div>
  );
}
