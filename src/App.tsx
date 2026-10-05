import Editor, { type OnMount } from "@monaco-editor/react";
import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePDFSlick } from "@pdfslick/react";
import type { SiglumCompiler } from "@siglum/engine";
import { DEFAULT_TEMPLATE } from "./template";

const STORAGE_KEY = "resume-editor:source";
const SIGLUM_BASE = "https://cdn.siglum.org/tl2025";
const ctanProxyUrl = import.meta.env.VITE_SIGLUM_CTAN_PROXY_URL?.trim();

type EditorInstance = Parameters<OnMount>[0];
type CompileFailure = {
  message: string;
  firstFatal: string;
  lastLines: string[];
};
type SavedPosition = { page: number; offset: number };

function parseCompileFailure(log: string, message: string): CompileFailure {
  const lines = log.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const fatal = lines.find((line) => /^!\s/.test(line)) ?? message;
  return {
    message,
    firstFatal: fatal,
    lastLines: lines.slice(-5),
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Icon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`icon ${className ?? ""}`} aria-hidden="true">
      {children}
    </span>
  );
}

export default function App() {
  const [source, setSource] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_TEMPLATE,
  );
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<CompileFailure | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [isErrorOpen, setIsErrorOpen] = useState(true);
  const [engineProgress, setEngineProgress] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | undefined>();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fitWidth, setFitWidth] = useState(false);
  const [splitPercent, setSplitPercent] = useState(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const editorRef = useRef<EditorInstance | null>(null);
  const compilerRef = useRef<SiglumCompiler | null>(null);
  const pdfBlobRef = useRef<Blob | null>(null);
  const compilerLogRef = useRef<string[]>([]);
  const currentPdfUrlRef = useRef<string | undefined>();
  const previousPdfUrlRef = useRef<string | undefined>();
  const viewerElementRef = useRef<HTMLElement | null>(null);
  const savedPositionRef = useRef<SavedPosition | null>(null);
  const pendingRestoreRef = useRef(false);
  const lastLoadedUrlRef = useRef<string | undefined>();
  const splitRef = useRef<HTMLDivElement | null>(null);
  const previewPaneRef = useRef<HTMLElement | null>(null);

  const {
    PDFSlickViewer,
    viewerRef,
    usePDFSlickStore,
    isDocumentLoaded,
    error: viewerError,
    store,
  } = usePDFSlick(pdfUrl, { scaleValue: fitWidth ? "page-width" : "page-fit" });
  const pageNumber = usePDFSlickStore((state) => state.pageNumber);
  const numPages = usePDFSlickStore((state) => state.numPages);
  const scale = usePDFSlickStore((state) => state.scale);
  const pagesReady = usePDFSlickStore((state) => state.pagesReady);
  const loadedUrl = usePDFSlickStore((state) => state.url);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, source);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [source]);

  useEffect(() => {
    currentPdfUrlRef.current = pdfUrl;
  }, [pdfUrl]);

  useEffect(() => {
    if (
      !isDocumentLoaded ||
      !pagesReady ||
      !pdfUrl ||
      loadedUrl !== pdfUrl ||
      lastLoadedUrlRef.current === pdfUrl
    ) return;

    const oldUrl = previousPdfUrlRef.current;
    lastLoadedUrlRef.current = pdfUrl;
    previousPdfUrlRef.current = undefined;

    if (pendingRestoreRef.current) {
      const position = savedPositionRef.current;
      const viewer = viewerElementRef.current;
      const pdfSlick = store.getState().pdfSlick;
      if (position && viewer && pdfSlick) {
        const page = Math.max(1, Math.min(position.page, numPages || 1));
        pdfSlick.gotoPage(page);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            const pageElement = viewer.querySelector<HTMLElement>(
              `.page[data-page-number="${page}"]`,
            );
            if (pageElement) {
              const pageTop =
                pageElement.getBoundingClientRect().top -
                viewer.getBoundingClientRect().top +
                viewer.scrollTop;
              viewer.scrollTop = pageTop + position.offset;
            }
            pendingRestoreRef.current = false;
          });
        });
      } else {
        pendingRestoreRef.current = false;
      }
    }

    if (oldUrl && oldUrl !== pdfUrl) URL.revokeObjectURL(oldUrl);
  }, [isDocumentLoaded, loadedUrl, numPages, pagesReady, pdfUrl, store]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === previewPaneRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(
    () => () => {
      if (currentPdfUrlRef.current) URL.revokeObjectURL(currentPdfUrlRef.current);
      if (previousPdfUrlRef.current) URL.revokeObjectURL(previousPdfUrlRef.current);
      compilerRef.current?.terminate();
    },
    [],
  );

  const attachViewerRef = useCallback(
    (node: HTMLElement | null) => {
      viewerRef(node);
      viewerElementRef.current = node;
      setViewerReady(Boolean(node));
    },
    [viewerRef],
  );

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setEditorReady(true);
    monaco.languages.register({ id: "latex" });
    monaco.languages.setMonarchTokensProvider("latex", {
      tokenizer: {
        root: [
          [/%.*/, "comment"],
          [/\\[a-zA-Z@]+/, "keyword"],
          [/\\./, "keyword"],
          [/[{}[\]]/, "delimiter"],
          [/\d+/, "number"],
          [/[a-zA-Z]+/, "identifier"],
        ],
      },
    });
  };

  const capturePdfPosition = useCallback(() => {
    const viewer = viewerElementRef.current;
    if (!viewer) {
      savedPositionRef.current = { page: pageNumber || 1, offset: 0 };
      return;
    }
    const viewerTop = viewer.getBoundingClientRect().top;
    const pages = Array.from(viewer.querySelectorAll<HTMLElement>(".page"));
    const visiblePage =
      pages.find((page) => {
        const rect = page.getBoundingClientRect();
        return rect.bottom > viewerTop && rect.top <= viewerTop + viewer.clientHeight;
      }) ??
      pages.find((page) => Number(page.dataset.pageNumber) === pageNumber) ??
      pages[0];
    if (!visiblePage) {
      savedPositionRef.current = { page: pageNumber || 1, offset: 0 };
      return;
    }
    const pageTop =
      visiblePage.getBoundingClientRect().top - viewerTop + viewer.scrollTop;
    savedPositionRef.current = {
      page: Number(visiblePage.dataset.pageNumber) || pageNumber || 1,
      offset: viewer.scrollTop - pageTop,
    };
  }, [pageNumber]);

  const compile = async () => {
    if (isCompiling) return;
    setIsCompiling(true);
    setCompileError(null);
    setEngineProgress("Starting XeLaTeX…");
    compilerLogRef.current = [];
    capturePdfPosition();
    pendingRestoreRef.current = Boolean(pdfUrl);

    try {
      if (typeof SharedArrayBuffer === "undefined" || !crossOriginIsolated) {
        throw new Error(
          "This page is not cross-origin isolated. Serve it with COOP: same-origin and COEP: require-corp headers to enable the WebAssembly engine.",
        );
      }

      if (!compilerRef.current) {
        const { SiglumCompiler: Compiler } = await import("@siglum/engine");
        compilerRef.current = new Compiler({
          bundlesUrl: `${SIGLUM_BASE}/bundles`,
          wasmUrl: `${SIGLUM_BASE}/busytex.wasm`,
          jsUrl: `${SIGLUM_BASE}/busytex.js`,
          workerUrl: `${import.meta.env.BASE_URL}worker.js`,
          ctanProxyUrl: ctanProxyUrl || undefined,
          enableCtan: Boolean(ctanProxyUrl),
          enableLazyFS: true,
          enableDocCache: true,
          onProgress: (stage, detail) => setEngineProgress(`${stage}: ${detail}`),
          onLog: (message) => {
            compilerLogRef.current.push(message);
            setEngineProgress(message);
          },
        });
      }

      await compilerRef.current.init();
      const result = await compilerRef.current.compile(source, {
        engine: "xelatex",
        useCache: true,
      });
      if (!result.success || !result.pdf) {
        throw Object.assign(new Error(result.error || "XeLaTeX compilation failed."), {
          texLog: [result.log, ...compilerLogRef.current].filter(Boolean).join("\n"),
        });
      }

      const pdfArrayBuffer = new ArrayBuffer(result.pdf.byteLength);
      new Uint8Array(pdfArrayBuffer).set(result.pdf);
      const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" });
      const nextUrl = URL.createObjectURL(pdfBlob);
      previousPdfUrlRef.current = currentPdfUrlRef.current;
      lastLoadedUrlRef.current = undefined;
      pdfBlobRef.current = pdfBlob;
      setPdfUrl(nextUrl);
      setCompileError(null);
      setErrorCount(0);
      setIsErrorOpen(false);
    } catch (error) {
      pendingRestoreRef.current = false;
      const message = error instanceof Error ? error.message : String(error);
      const log =
        typeof error === "object" && error !== null && "texLog" in error
          ? String(error.texLog)
          : "";
      const failure = parseCompileFailure(log, message);
      setCompileError(failure);
      setErrorCount((count) => count + 1);
      setIsErrorOpen(true);
    } finally {
      setIsCompiling(false);
      setEngineProgress("");
    }
  };

  const downloadTex = () => {
    downloadBlob(new Blob([source], { type: "text/plain;charset=utf-8" }), "resume.tex");
  };

  const downloadPdf = async () => {
    if (!pdfBlobRef.current) return;
    downloadBlob(pdfBlobRef.current, "resume.pdf");
  };

  const changeScale = (direction: -1 | 1) => {
    const pdfSlick = store.getState().pdfSlick;
    if (!pdfSlick) return;
    setFitWidth(false);
    if (direction > 0) pdfSlick.increaseScale();
    else pdfSlick.decreaseScale();
  };

  const changePage = (event: ChangeEvent<HTMLInputElement>) => {
    const nextPage = Number(event.target.value);
    if (Number.isInteger(nextPage) && nextPage >= 1 && nextPage <= numPages) {
      store.getState().pdfSlick?.gotoPage(nextPage);
    }
  };

  const toggleFitWidth = () => {
    const nextFit = !fitWidth;
    setFitWidth(nextFit);
    const pdfSlick = store.getState().pdfSlick;
    if (pdfSlick) {
      store.setState({ scaleValue: nextFit ? "page-width" : "page-fit" });
      pdfSlick.viewer.currentScaleValue = nextFit ? "page-width" : "page-fit";
    }
  };

  const toggleFullscreen = async () => {
    if (!previewPaneRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await previewPaneRef.current.requestFullscreen();
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDraggingSplit(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resizePanes = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isDraggingSplit || !splitRef.current) return;
    const bounds = splitRef.current.getBoundingClientRect();
    const percent = ((event.clientX - bounds.left) / bounds.width) * 100;
    setSplitPercent(Math.min(75, Math.max(25, percent)));
  };

  const stopResize = () => setIsDraggingSplit(false);
  const pageCount = numPages || 0;
  const zoomLabel = `${Math.round((scale || 1) * 100)}%`;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Resume Studio home">
          <span className="brand-mark">R</span>
          <span>resume<span className="brand-light">studio</span></span>
        </a>
        <div className="toolbar-actions">
          <button
            className={`button button-primary ${isCompiling ? "is-busy" : ""}`}
            type="button"
            onClick={compile}
            disabled={isCompiling}
            title="Compile with XeLaTeX"
          >
            {isCompiling ? <span className="spinner" /> : <Icon>▶</Icon>}
            {isCompiling ? "Compiling" : "Compile"}
            {errorCount > 0 && <span className="error-badge">{errorCount}</span>}
          </button>
          <span className="toolbar-separator" />
          <button
            className="button button-quiet"
            type="button"
            aria-label="Undo"
            title="Undo"
            disabled={!editorReady}
            onClick={() => editorRef.current?.trigger("toolbar", "undo", null)}
          >
            <Icon>↶</Icon><span className="button-label">Undo</span>
          </button>
          <button
            className="button button-quiet"
            type="button"
            aria-label="Redo"
            title="Redo"
            disabled={!editorReady}
            onClick={() => editorRef.current?.trigger("toolbar", "redo", null)}
          >
            <Icon>↷</Icon><span className="button-label">Redo</span>
          </button>
          <span className="toolbar-separator" />
          <button
            className="button button-quiet"
            type="button"
            aria-label="Download .tex source"
            title="Download .tex source"
            onClick={downloadTex}
          >
            <Icon>↓</Icon><span className="button-label">.tex</span>
          </button>
          <button
            className="button button-quiet"
            type="button"
            onClick={() => void downloadPdf()}
            disabled={!pdfUrl}
          >
            <Icon>⇩</Icon><span className="button-label">PDF</span>
          </button>
        </div>
        <div className="topbar-status">
          <span className="status-dot" />
          <span>Saved locally</span>
        </div>
      </header>

      <section
        className={`workbench ${isDraggingSplit ? "is-resizing" : ""}`}
        ref={splitRef}
        style={{ "--split": `${splitPercent}%` } as React.CSSProperties}
      >
        <section className="editor-pane" aria-label="LaTeX source editor">
          <div className="pane-heading">
            <div className="pane-title">
              <Icon className="file-icon">▤</Icon>
              <span>resume.tex</span>
              <span className="file-type">LaTeX</span>
            </div>
            <span className="pane-meta">XeLaTeX</span>
          </div>
          <div className="editor-container">
            <Editor
              height="100%"
              language="latex"
              theme="vs-dark"
              value={source}
              onChange={(value) => setSource(value ?? "")}
              onMount={handleEditorMount}
              options={{
                automaticLayout: true,
                fontFamily: "'Cascadia Code', 'SFMono-Regular', Consolas, monospace",
                fontSize: 14,
                lineHeight: 22,
                minimap: { enabled: false },
                lineNumbers: "on",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                wordWrap: "on",
                bracketPairColorization: { enabled: true },
                matchBrackets: "always",
                autoIndent: "full",
                tabSize: 4,
                padding: { top: 16, bottom: 24 },
                renderLineHighlight: "line",
                guides: { indentation: true },
                suggest: { showWords: false },
              }}
            />
          </div>
          <div className="editor-footer">
            <span><span className="footer-dot" /> LaTeX</span>
            <span>UTF-8&nbsp;&nbsp; · &nbsp;&nbsp;{source.split("\n").length} lines</span>
          </div>
          {compileError && (
            <section className="error-panel" aria-live="polite">
              <button
                className="error-panel-heading"
                type="button"
                onClick={() => setIsErrorOpen((open) => !open)}
                aria-expanded={isErrorOpen}
              >
                <span><span className="error-symbol">!</span> Compilation failed</span>
                <span className="error-chevron">{isErrorOpen ? "⌄" : "›"}</span>
              </button>
              {isErrorOpen && (
                <div className="error-content">
                  <p className="fatal-line">{compileError.firstFatal}</p>
                  <pre>{compileError.lastLines.join("\n") || compileError.message}</pre>
                  {!ctanProxyUrl && (
                    <p className="proxy-hint">
                      Package fetching is disabled because no CTAN proxy is configured.
                      If the log reports a missing .sty or .cls package, run Siglum&apos;s
                      proxy and set VITE_SIGLUM_CTAN_PROXY_URL (for example,
                      http://localhost:8081) to its CORS-enabled URL, then restart Vite.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </section>

        <button
          className="split-divider"
          type="button"
          aria-label="Resize editor and preview panes"
          onPointerDown={startResize}
          onPointerMove={resizePanes}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
        >
          <span />
        </button>

        <section className="preview-pane" aria-label="Compiled PDF preview" ref={previewPaneRef}>
          <div className="preview-toolbar">
            <div className="preview-nav">
              <button
                className="icon-button"
                type="button"
                aria-label="Previous page"
                title="Previous page"
                disabled={!pdfUrl || pageNumber <= 1}
                onClick={() => store.getState().pdfSlick?.gotoPage(Math.max(1, pageNumber - 1))}
              >‹</button>
              <label className="page-control">
                <input
                  aria-label="Current page"
                  value={pageNumber || 0}
                  onChange={changePage}
                  disabled={!pdfUrl}
                />
                <span>/ {pageCount}</span>
              </label>
              <button
                className="icon-button"
                type="button"
                aria-label="Next page"
                title="Next page"
                disabled={!pdfUrl || pageNumber >= pageCount}
                onClick={() =>
                  store.getState().pdfSlick?.gotoPage(Math.min(pageCount, pageNumber + 1))
                }
              >›</button>
            </div>
            <span className="preview-divider" />
            <div className="zoom-control">
              <button
                className="icon-button"
                type="button"
                aria-label="Zoom out"
                title="Zoom out"
                disabled={!pdfUrl}
                onClick={() => changeScale(-1)}
              >−</button>
              <span className="zoom-value">{zoomLabel}</span>
              <button
                className="icon-button"
                type="button"
                aria-label="Zoom in"
                title="Zoom in"
                disabled={!pdfUrl}
                onClick={() => changeScale(1)}
              >+</button>
            </div>
            <span className="preview-divider" />
            <button
              className={`preview-action ${fitWidth ? "selected" : ""}`}
              type="button"
              disabled={!pdfUrl}
              aria-label={fitWidth ? "Fit page" : "Fit width"}
              onClick={toggleFitWidth}
              title={fitWidth ? "Fit to page" : "Fit width"}
            ><Icon>↔</Icon><span className="button-label">{fitWidth ? "Fit Page" : "Fit Width"}</span></button>
            <button
              className="preview-action"
              type="button"
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => void toggleFullscreen()}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            ><Icon>{isFullscreen ? "⤢" : "⛶"}</Icon><span className="button-label">Fullscreen</span></button>
            <button
              className="icon-button download-preview"
              type="button"
              aria-label="Download PDF"
              title="Download PDF"
              disabled={!pdfUrl}
              onClick={() => void downloadPdf()}
            >⇩</button>
          </div>
          <div className="pdf-stage">
            <PDFSlickViewer
              viewerRef={attachViewerRef}
              usePDFSlickStore={usePDFSlickStore}
              className="resume-pdf-viewer"
            />
            {!pdfUrl && (
              <div className="empty-preview">
                <div className="empty-page-icon">
                  <span />
                  <span />
                  <span />
                  <b>PDF</b>
                </div>
                <h2>Your resume preview</h2>
                <p>Compile your LaTeX source to see the PDF here.</p>
                <button className="button button-primary" type="button" onClick={compile} disabled={isCompiling}>
                  {isCompiling ? <span className="spinner" /> : <Icon>▶</Icon>}
                  {isCompiling ? "Compiling…" : "Compile resume"}
                </button>
                {engineProgress && <span className="engine-progress">{engineProgress}</span>}
                {viewerError && <span className="viewer-error">{viewerError.message}</span>}
              </div>
            )}
            {pdfUrl && !isDocumentLoaded && (
              <div className="pdf-loading" aria-live="polite">
                <span className="spinner spinner-dark" /> Loading compiled PDF…
              </div>
            )}
            {pdfUrl && !viewerReady && <span className="sr-only">Preparing PDF viewer</span>}
          </div>
          <div className="preview-footer">
            <span>{pdfUrl ? "resume.pdf" : "No compiled PDF yet"}</span>
            <span>{pdfUrl ? `${pageCount} ${pageCount === 1 ? "page" : "pages"}` : "PDF preview"}</span>
          </div>
        </section>
      </section>
    </main>
  );
}
