import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { CompileFailure } from "../types";
import { parseOutline } from "../utils";
import { Icon } from "../../../components/Icon";

type EditorPaneProps = {
  source: string;
  documentName: string;
  compileError: CompileFailure | null;
  isErrorOpen: boolean;
  ctanProxyUrl: string | undefined;
  isLightMode: boolean;
  onSourceChange: (source: string) => void;
  onDocumentNameChange: (name: string) => void;
  onEditorMount: OnMount;
  onNavigateToLine: (line: number) => void;
  onToggleError: () => void;
};

export function EditorPane({
  source,
  documentName,
  compileError,
  isErrorOpen,
  ctanProxyUrl,
  isLightMode,
  onSourceChange,
  onDocumentNameChange,
  onEditorMount,
  onNavigateToLine,
  onToggleError,
}: EditorPaneProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(`${documentName}.tex`);
  const [fontSize, setFontSize] = useState(14);
  const [copyStatus, setCopyStatus] = useState("");
  const [activeSidebarPanel, setActiveSidebarPanel] = useState<"outline" | "files" | null>("outline");
  const [isOutlineExpanded, setIsOutlineExpanded] = useState(true);
  const [outlineWidth, setOutlineWidth] = useState(164);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cancelRenameRef = useRef(false);
  const outlineResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const outline = parseOutline(source);

  useEffect(() => {
    if (isRenaming) {
      cancelRenameRef.current = false;
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    } else {
      setDraftName(`${documentName}.tex`);
    }
  }, [documentName, isRenaming]);

  const finishRename = () => {
    onDocumentNameChange(draftName);
    setIsRenaming(false);
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finishRename();
    } else if (event.key === "Escape") {
      cancelRenameRef.current = true;
      setDraftName(`${documentName}.tex`);
      setIsRenaming(false);
    }
  };

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed");
    }
  };

  const startOutlineResize = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!activeSidebarPanel || event.clientX < bounds.right - 7) return;
    event.preventDefault();
    outlineResizeRef.current = { startX: event.clientX, startWidth: bounds.width - 38 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resizeOutline = (event: PointerEvent<HTMLElement>) => {
    if (!outlineResizeRef.current) return;
    const { startX, startWidth } = outlineResizeRef.current;
    setOutlineWidth(Math.min(360, Math.max(120, startWidth + event.clientX - startX)));
  };

  const stopOutlineResize = () => {
    outlineResizeRef.current = null;
  };

  return (
    <section className="editor-pane" aria-label="LaTeX source editor">
      <div className="pane-heading">
        <div className="pane-title">
          <Icon className="file-icon">▤</Icon>
          {isRenaming ? (
            <input
              ref={nameInputRef}
              className="filename-input"
              aria-label="File name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => {
                if (cancelRenameRef.current) {
                  cancelRenameRef.current = false;
                  return;
                }
                finishRename();
              }}
              onKeyDown={handleNameKeyDown}
            />
          ) : (
            <>
              <span className="filename-label">{documentName}.tex</span>
              <button
                className="filename-edit"
                type="button"
                aria-label="Rename file"
                title="Rename file"
                onClick={() => setIsRenaming(true)}
              >
                <Icon>✎</Icon>
              </button>
            </>
          )}
          <span className="file-type">LaTeX</span>
        </div>
        <div className="editor-heading-actions">
          <div className="zoom-control" role="group" aria-label="Code editor zoom controls">
            <button
              className="icon-button"
              type="button"
              aria-label="Zoom code out"
              title="Zoom code out"
              disabled={fontSize <= 8}
              onClick={() => setFontSize((size) => Math.max(8, size - 1))}
            >−</button>
            <span className="zoom-value">{fontSize}px</span>
            <button
              className="icon-button"
              type="button"
              aria-label="Zoom code in"
              title="Zoom code in"
              disabled={fontSize >= 32}
              onClick={() => setFontSize((size) => Math.min(32, size + 1))}
            >+</button>
          </div>
          <span className="pane-meta">pdfLaTeX</span>
        </div>
      </div>
      <div className="editor-workspace">
        <nav
          className={`outline-pane ${outlineResizeRef.current ? "is-resizing" : ""}`}
          aria-label="Editor sidebar"
          style={{ flexBasis: activeSidebarPanel ? 38 + outlineWidth : 38 }}
          onPointerDown={startOutlineResize}
          onPointerMove={resizeOutline}
          onPointerUp={stopOutlineResize}
          onPointerCancel={stopOutlineResize}
        >
          <div className="outline-sidebar-rail">
            <button
              className="icon-button outline-sidebar-toggle"
              type="button"
              aria-label={activeSidebarPanel === "outline" ? "Hide outline panel" : "Show outline panel"}
              aria-expanded={activeSidebarPanel === "outline"}
              aria-pressed={activeSidebarPanel === "outline"}
              title={activeSidebarPanel === "outline" ? "Hide outline panel" : "Show outline panel"}
              onClick={() => setActiveSidebarPanel((panel) => panel === "outline" ? null : "outline")}
            >
              <svg viewBox="0 0 18 18" aria-hidden="true">
                <path d="M3 4.5h12M3 9h12M3 13.5h12" />
              </svg>
            </button>
            <button
              className={`icon-button outline-files-button ${activeSidebarPanel === "files" ? "is-active" : ""}`}
              type="button"
              aria-label="Show files panel"
              aria-pressed={activeSidebarPanel === "files"}
              title="Files"
              onClick={() => setActiveSidebarPanel((panel) => panel === "files" ? null : "files")}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M3.5 5.5h5l1.6 1.8h6.4v8.2h-13z" />
                <path d="M3.5 5.5V4.2h5l1.6 1.8" />
              </svg>
            </button>
          </div>
          {activeSidebarPanel && (
            <div className="outline-content" style={{ flexBasis: outlineWidth }}>
              {activeSidebarPanel === "outline" ? (
                <>
              <div className="outline-heading">
                <button
                  className="icon-button outline-toggle"
                  type="button"
                  aria-label={isOutlineExpanded ? "Collapse outline sections" : "Expand outline sections"}
                  aria-expanded={isOutlineExpanded}
                  title={isOutlineExpanded ? "Collapse outline sections" : "Expand outline sections"}
                  onClick={() => setIsOutlineExpanded((expanded) => !expanded)}
                >
                  <span className={`outline-chevron ${isOutlineExpanded ? "is-expanded" : ""}`} aria-hidden="true">›</span>
                </button>
                <span className="outline-title">Outline</span>
                <span className="outline-count">{outline.length}</span>
              </div>
              {isOutlineExpanded && (outline.length ? (
                <div className="outline-list">
                  {outline.map((heading) => (
                    <button
                      className="outline-item"
                      type="button"
                      key={`${heading.line}-${heading.title}`}
                      style={{ paddingLeft: `${10 + heading.depth * 12}px` }}
                      title={`${heading.title} (line ${heading.line})`}
                      onClick={() => onNavigateToLine(heading.line)}
                    >
                      {heading.title}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="outline-empty">No sections found</p>
              ))}
                </>
              ) : (
                <div className="outline-files-panel">
                  <div className="outline-heading">
                    <span className="outline-title">Files</span>
                  </div>
                  <p className="outline-empty">Multi-file projects are coming soon.</p>
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="editor-container">
          <Editor
            height="100%"
            language="latex"
            theme={isLightMode ? "latex-light" : "latex-dark"}
            value={source}
            onChange={(value) => onSourceChange(value ?? "")}
            onMount={onEditorMount}
            options={{
              automaticLayout: true,
              fontFamily: "'Cascadia Code', 'SFMono-Regular', Consolas, monospace",
              fontSize,
              lineHeight: fontSize + 8,
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
              renderValidationDecorations: "on",
              quickSuggestions: { other: true, comments: true, strings: true },
              snippetSuggestions: "top",
              stickyScroll: { enabled: true },
            }}
          />
        </div>
      </div>
      <div className="editor-footer">
        <div className="editor-footer-leading">
          <span><span className="footer-dot" /> LaTeX</span>
          <button
            className="copy-source-button"
            type="button"
            aria-label="Copy full LaTeX source"
            title="Copy full LaTeX source"
            onClick={copySource}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="5" y="2" width="9" height="11" rx="1.5" />
              <path d="M11 14H3.5A1.5 1.5 0 0 1 2 12.5V4" />
            </svg>
          </button>
          <span className="copy-status" aria-live="polite">{copyStatus}</span>
        </div>
        <span>UTF-8&nbsp;&nbsp; · &nbsp;&nbsp;{source.split("\n").length} lines</span>
      </div>
      {compileError && (
        <section className="error-panel" aria-live="polite">
          <button
            className="error-panel-heading"
            type="button"
            onClick={onToggleError}
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
                  For a deployed build, set VITE_SIGLUM_CTAN_PROXY_URL to the root
                  URL of a CORS-enabled proxy that exposes /api/texlive/:package,
                  then rebuild the app.
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
