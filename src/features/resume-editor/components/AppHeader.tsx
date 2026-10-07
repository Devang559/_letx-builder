import { Icon } from "../../../components/Icon";

type AppHeaderProps = {
  isCompiling: boolean;
  errorCount: number;
  editorReady: boolean;
  hasPdf: boolean;
  isLightMode: boolean;
  onOpenHistory: () => void;
  onCompile: () => void;
  onToggleTheme: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDownloadTex: () => void;
  onDownloadPdf: () => void;
};

export function AppHeader({
  isCompiling,
  errorCount,
  editorReady,
  hasPdf,
  isLightMode,
  onOpenHistory,
  onCompile,
  onToggleTheme,
  onUndo,
  onRedo,
  onDownloadTex,
  onDownloadPdf,
}: AppHeaderProps) {
  return (
    <header className="topbar">
      <a className="brand" href="#" aria-label="LetXBuilder home">
        <span className="brand-mark">L</span>
        <span>LetX<span className="brand-light">Builder</span></span>
      </a>
      <div className="toolbar-actions">
        <button
          className={`button button-primary ${isCompiling ? "is-busy" : ""}`}
          type="button"
          onClick={onCompile}
          disabled={isCompiling}
          title="Compile with pdfLaTeX"
        >
          {isCompiling ? <span className="spinner" /> : <Icon>▶</Icon>}
          {isCompiling ? "Compiling" : "Compile"}
          {errorCount > 0 && <span className="error-badge">{errorCount}</span>}
        </button>
        <span className="toolbar-separator" />
        <button
          className="button button-quiet"
          type="button"
          aria-label={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
          title={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
          onClick={onToggleTheme}
        >
          <Icon>{isLightMode ? "☾" : "☀"}</Icon><span className="button-label">{isLightMode ? "Dark" : "Light"}</span>
        </button>
        <button
          className="button button-quiet"
          type="button"
          aria-label="Undo"
          title="Undo"
          disabled={!editorReady}
          onClick={onUndo}
        >
          <Icon>↶</Icon><span className="button-label">Undo</span>
        </button>
        <button
          className="button button-quiet"
          type="button"
          aria-label="Redo"
          title="Redo"
          disabled={!editorReady}
          onClick={onRedo}
        >
          <Icon>↷</Icon><span className="button-label">Redo</span>
        </button>
        <span className="toolbar-separator" />
        <button
          className="button button-quiet"
          type="button"
          aria-label="Download .tex source"
          title="Download .tex source"
          onClick={onDownloadTex}
        >
          <Icon>↓</Icon><span className="button-label">.tex</span>
        </button>
        <button
          className="button button-quiet"
          type="button"
          onClick={onDownloadPdf}
          disabled={!hasPdf}
        >
          <Icon>⇩</Icon><span className="button-label">PDF</span>
        </button>
      </div>
      <button
        className="button button-quiet history-toolbar-button"
        type="button"
        aria-label="Compile history"
        title="Compile history"
        onClick={onOpenHistory}
      >
        <svg className="history-icon" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M3.2 6.2A6.1 6.1 0 1 1 3 9" />
          <path d="M3 3.7v2.8h2.8M9 5.2v4l2.6 1.6" />
        </svg>
        <span className="button-label">History</span>
      </button>
    </header>
  );
}
