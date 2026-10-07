import { type OnMount } from "@monaco-editor/react";
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
import { AppHeader } from "../features/resume-editor/components/AppHeader";
import { EditorPane } from "../features/resume-editor/components/EditorPane";
import { HistoryScreen } from "../features/resume-editor/components/HistoryScreen";
import {
  COMPILE_HISTORY_KEY,
  CTAN_PROXY_URL,
  DOCUMENT_NAME_KEY,
  SIGLUM_BASE,
  STORAGE_KEY,
} from "../features/resume-editor/config";
import { DEFAULT_TEMPLATE } from "../features/resume-editor/template";
import type {
  CompileFailure,
  CompileHistoryEntry,
  SavedPosition,
} from "../features/resume-editor/types";
import {
  downloadBlob,
  normalizeDocumentName,
  parseCompileHistory,
  parseCompileFailure,
} from "../features/resume-editor/utils";
import { Icon } from "../components/Icon";

type EditorInstance = Parameters<OnMount>[0];

export default function App() {
  const [source, setSource] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_TEMPLATE,
  );
  const [documentName, setDocumentName] = useState(() =>
    normalizeDocumentName(localStorage.getItem(DOCUMENT_NAME_KEY) ?? "resume"),
  );
  const [isCompiling, setIsCompiling] = useState(false);
  const [isLightMode, setIsLightMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme-mode");
    if (savedTheme) return savedTheme === "light";
    return window.matchMedia("(prefers-color-scheme: light)").matches;
  });
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyState, setHistoryState] = useState(() => {
    try {
      return { entries: parseCompileHistory(localStorage.getItem(COMPILE_HISTORY_KEY)), error: "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { entries: [] as CompileHistoryEntry[], error: `Could not read saved history: ${message}` };
    }
  });
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
    localStorage.setItem(DOCUMENT_NAME_KEY, documentName);
  }, [documentName]);

  useEffect(() => {
    localStorage.setItem("theme-mode", isLightMode ? "light" : "dark");
  }, [isLightMode]);

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

    monaco.editor.defineTheme("latex-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6b7280", fontStyle: "italic" },
        { token: "keyword", foreground: "1d4ed8", fontStyle: "bold" },
        { token: "string", foreground: "0f766e" },
        { token: "number", foreground: "b45309" },
        { token: "delimiter", foreground: "475569" },
        { token: "math", foreground: "7c3aed" },
        { token: "identifier", foreground: "1f2937" },
      ],
      colors: {
        "editor.background": "#f8fafc",
        "editorLineNumber.foreground": "#94a3b8",
        "editorCursor.foreground": "#0f172a",
        "editor.selectionBackground": "#bfdbfe",
        "editor.lineHighlightBackground": "#f1f5f9",
      },
    });

    monaco.editor.defineTheme("latex-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "8b949e", fontStyle: "italic" },
        { token: "keyword", foreground: "7dd3fc", fontStyle: "bold" },
        { token: "string", foreground: "5eead4" },
        { token: "number", foreground: "fbbf24" },
        { token: "delimiter", foreground: "cbd5e1" },
        { token: "math", foreground: "c4b5fd" },
        { token: "identifier", foreground: "e2e8f0" },
      ],
      colors: {
        "editor.background": "#0f172a",
        "editorLineNumber.foreground": "#64748b",
        "editorCursor.foreground": "#f8fafc",
        "editor.selectionBackground": "#334155",
        "editor.lineHighlightBackground": "#111827",
      },
    });

    monaco.languages.register({ id: "latex" });
    monaco.languages.setMonarchTokensProvider("latex", {
      defaultToken: "text",
      tokenizer: {
        root: [
          [/%.*/, "comment"],
          [/\\[A-Za-z@]+\*?/, "keyword"],
          [/\\./, "keyword"],
          [/\^|_/, "math"],
          [/[{}\[\]()]/, "delimiter"],
          [/[+-]?\d+(?:\.\d+)?/, "number"],
          [/"(?:[^"]|\\")*"/, "string"],
          [/'(?:[^']|\\')*'/, "string"],
          [/[A-Za-z]+/, "identifier"],
          [/\s+/, "white"],
        ],
      },
    });
  };

  const navigateToLine = (line: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();
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
    const sourceToCompile = source;
    setIsCompiling(true);
    setCompileError(null);
    setEngineProgress("Starting pdfLaTeX…");
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
        const { SiglumCompiler: Compiler, forceRefreshPackage } = await import("@siglum/engine");
        const cacheMigrationKey = "resume-editor:siglum-package-cache:tl2025-api-v4";
        if (CTAN_PROXY_URL && localStorage.getItem(cacheMigrationKey) !== "done") {
          const refreshed = await Promise.all(
            ["helvetic", "phvr7t", "psnfss", "fontawesome5"].map(forceRefreshPackage),
          );
          if (refreshed.some((success) => !success)) {
            throw new Error("Could not refresh the cached TeX package results. Clear this site's storage and retry.");
          }
          localStorage.setItem(cacheMigrationKey, "done");
        }
        compilerRef.current = new Compiler({
          bundlesUrl: `${SIGLUM_BASE}/bundles`,
          wasmUrl: `${SIGLUM_BASE}/busytex.wasm`,
          jsUrl: `${SIGLUM_BASE}/busytex.js`,
          xzwasmUrl: `${import.meta.env.BASE_URL}xzwasm.min.js`,
          workerUrl: `${import.meta.env.BASE_URL}worker.js`,
          ctanProxyUrl: CTAN_PROXY_URL || undefined,
          enableCtan: Boolean(CTAN_PROXY_URL),
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
      const result = await compilerRef.current.compile(sourceToCompile, {
        engine: 'pdflatex',
        useCache: true,
      });
      if (!result.success || !result.pdf) {
        throw Object.assign(new Error(result.error || "pdfLaTeX compilation failed."), {
          texLog: [...compilerLogRef.current, result.log].filter(Boolean).join("\n"),
        });
      }

      const historyEntry: CompileHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        documentName,
        source: sourceToCompile,
        compiledAt: new Date().toISOString(),
      };
      const nextHistory = [...historyState.entries, historyEntry];
      try {
        localStorage.setItem(COMPILE_HISTORY_KEY, JSON.stringify(nextHistory));
        setHistoryState({ entries: nextHistory, error: "" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setHistoryState((current) => ({
          ...current,
          error: `The PDF compiled, but its history could not be saved in this browser: ${message}`,
        }));
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
    downloadBlob(
      new Blob([source], { type: "text/plain;charset=utf-8" }),
      `${documentName}.tex`,
    );
  };

  const downloadPdf = async () => {
    if (!pdfBlobRef.current) return;
    downloadBlob(pdfBlobRef.current, `${documentName}.pdf`);
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
    <main className={`app-shell ${isLightMode ? "theme-light" : ""}`}>
      <AppHeader
        isCompiling={isCompiling}
        errorCount={errorCount}
        editorReady={editorReady}
        hasPdf={Boolean(pdfUrl)}
        isLightMode={isLightMode}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onCompile={compile}
        onToggleTheme={() => setIsLightMode((current) => !current)}
        onUndo={() => editorRef.current?.trigger("toolbar", "undo", null)}
        onRedo={() => editorRef.current?.trigger("toolbar", "redo", null)}
        onDownloadTex={downloadTex}
        onDownloadPdf={() => void downloadPdf()}
      />
      {isHistoryOpen && (
        <HistoryScreen
          entries={historyState.entries}
          error={historyState.error}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      <section
        className={`workbench ${isDraggingSplit ? "is-resizing" : ""}`}
        ref={splitRef}
        style={{ "--split": `${splitPercent}%` } as React.CSSProperties}
      >
        <EditorPane
          source={source}
          documentName={documentName}
          compileError={compileError}
          isErrorOpen={isErrorOpen}
          ctanProxyUrl={CTAN_PROXY_URL}
          isLightMode={isLightMode}
          onSourceChange={setSource}
          onDocumentNameChange={(name) => setDocumentName(normalizeDocumentName(name))}
          onEditorMount={handleEditorMount}
          onNavigateToLine={navigateToLine}
          onToggleError={() => setIsErrorOpen((open) => !open)}
        />

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
                  id="current-page"
                  name="currentPage"
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
            <span>{pdfUrl ? `${documentName}.pdf` : "No compiled PDF yet"}</span>
            <span>{pdfUrl ? `${pageCount} ${pageCount === 1 ? "page" : "pages"}` : "PDF preview"}</span>
          </div>
        </section>
      </section>
    </main>
  );
}
