import type { CompileHistoryEntry } from "../types";
import { Icon } from "../../../components/Icon";

type HistoryScreenProps = {
  entries: CompileHistoryEntry[];
  error: string;
  onClose: () => void;
};

function formatCompileTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function HistoryScreen({ entries, error, onClose }: HistoryScreenProps) {
  return (
    <section className="history-screen" role="dialog" aria-modal="true" aria-labelledby="history-title">
      <header className="history-header">
        <div>
          <h1 id="history-title">Compile history</h1>
          <p>Local snapshots of your source, saved when you compile.</p>
        </div>
        <button className="button button-quiet history-close" type="button" onClick={onClose}>
          <Icon>×</Icon><span className="button-label">Close</span>
        </button>
      </header>
      <div className="history-list">
        {error && <p className="history-error" role="alert">{error}</p>}
        {!entries.length && !error ? (
          <div className="history-empty">
            <h2>No compile history yet</h2>
            <p>Compile your document to save its source and timestamp here.</p>
          </div>
        ) : (
          [...entries].reverse().map((entry) => (
            <details className="history-entry" key={entry.id}>
              <summary>
                <span className="history-file"><Icon>▤</Icon>{entry.documentName}.tex</span>
                <time className="history-time" dateTime={entry.compiledAt}>
                  {formatCompileTime(entry.compiledAt)}
                </time>
              </summary>
              <pre className="history-source"><code>{entry.source}</code></pre>
            </details>
          ))
        )}
      </div>
      <footer className="history-footer">History is stored only in this browser.</footer>
    </section>
  );
}
