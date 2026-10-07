# LetXBuilder

LetXBuilder is a browser-based LaTeX resume editor designed for quick resume authoring and instant PDF preview without a backend. The app gives you a split-pane editing workspace where you can write LaTeX source in Monaco, compile it through a WebAssembly TeX engine, and preview the generated PDF in the same browser window.

This project is intentionally frontend-only: it stores draft content locally in the browser, uses Siglum's WebAssembly TeX Live runtime to compile PDFs in-browser, and exposes a lightweight UX for editing, debugging, and downloading resumes.

## Project summary

- Product type: desktop-style single-page LaTeX resume editor
- Primary user flow: edit source -> compile -> inspect PDF -> download .tex or .pdf
- Main stack: React + TypeScript + Vite + Monaco + Siglum + PDFSlick
- Execution model: client-side only; no server-side rendering or API layer
- Output: compile of LaTeX into a PDF using pdfLaTeX in the browser
- Persistence: localStorage and browser object URLs; compile history saved in localStorage

## Why this project exists

The app is meant to remove friction from resume editing by combining the power of LaTeX formatting with a live PDF preview. Instead of switching between a text editor, a TeX toolchain, and a browser preview, users stay in one experience and can iterate quickly on a reusable resume template.

The default template is designed for a technical resume and includes sections such as:
- contact details
- technical skills
- experience
- projects
- education

The project also includes all of the supporting UX required for an effective authoring workflow: compile history, source file rename, zoom controls, outline navigation, and error reporting.

## Core features

### 1. Browser-side LaTeX editing
- Monaco-based editor with LaTeX language tokenization
- Syntax highlighting for commands, braces, numbers, strings, math operators, and identifiers
- Undo/redo support through Monaco's built-in editor commands
- Editable document filename with persisted name for downloads
- Live source persistence to localStorage with a 500 ms debounce

### 2. Resume template and source workflow
- Includes a ready-to-edit resume template in `src/features/resume-editor/template.ts`
- Defaults to a document name of `resume`
- Saves and restores source text and document name between sessions
- Allows copying the full LaTeX source to the clipboard
- Allows downloading the current source as `.tex`

### 3. Browser PDF compilation
- Uses `@siglum/engine` to compile with pdfLaTeX in the browser
- Requires `SharedArrayBuffer` and cross-origin isolation (`COOP: same-origin`, `COEP: require-corp`)
- Loads the Siglum WASM runtime and worker from CDN and local bundled assets
- Compiles through the browser with runtime caching and package caching
- Keeps the previous successful PDF on failure until the next successful compile
- Displays fatal compile errors and the final log lines for debugging

### 4. PDF preview and navigation
- Uses `@pdfslick/react` for preview rendering
- Supports:
  - page navigation
  - next/previous page buttons
  - page number editing
  - zoom in/out
  - fit width / fit page toggling
  - fullscreen preview
  - PDF download
- Saves and restores approximate page + scroll offset after recompiling

### 5. Outline sidebar and navigation
- Parses LaTeX section headings such as `\section`, `\subsection`, and related commands
- Lists headings in a sidebar for quick navigation
- Clicking an outline item jumps the editor cursor to the corresponding line
- Sidebar is resizable and supports expand/collapse behavior

### 6. Compile history
- Saves snapshots of source code and metadata on successful compile
- Stores entries in `localStorage` under a dedicated history key
- Allows viewing previous versions in a modal history dialog
- History is browser-local only and is not synced to any backend

### 7. Theme support
- Toggle between dark and light mode
- Theme state is persisted in localStorage
- Uses CSS variables to switch the entire app shell between palettes

### 8. Deployment readiness
- Configured to work with Vercel and Netlify
- Includes required COOP/COEP headers in deployment config
- Provides optional proxy settings for TeX Live packages outside Siglum bundles

## Tech stack

### Frontend
- React 18
- Vite 6
- TypeScript 5
- Tailwind CSS 3

### Editor and preview
- Monaco Editor via `@monaco-editor/react`
- PDF viewer via `@pdfslick/react`

### TeX engine
- `@siglum/engine`
- WebAssembly-based TeX Live bundle from Siglum
- Browser pdfLaTeX execution

### Supporting tooling
- `vite-plugin-wasm`
- `postcss` and `autoprefixer`
- custom install script to patch Siglum worker and copy XZ runtime files into `public/`

## Project structure

```text
.
├── .env.example                    # Example environment variables
├── .gitignore                     # Git ignores
├── index.html                     # Vite HTML shell
├── netlify.toml                   # Netlify COOP/COEP headers
├── package.json                   # Scripts and dependencies
├── package-lock.json              # Lock file for npm
├── postcss.config.js             # PostCSS configuration
├── tailwind.config.js            # Tailwind configuration
├── tsconfig*.json                 # TypeScript project config
├── vercel.json                   # Vercel COOP/COEP headers
├── vite.config.ts                # Vite config, WASM plugin, custom dev proxy
├── public/                       # Built worker and XZ runtime assets from install step
│   ├── worker.js
│   └── xzwasm.min.js
├── scripts/
│   └── copy-siglum-worker.mjs    # Patches Siglum worker for font/package handling
├── src/
│   ├── app/
│   │   └── App.tsx               # Main application state and lifecycle
│   ├── components/
│   │   └── Icon.tsx              # Shared icon wrapper
│   ├── features/
│   │   └── resume-editor/
│   │       ├── components/
│   │       │   ├── AppHeader.tsx      # Top toolbar/actions
│   │       │   ├── EditorPane.tsx     # Monaco editor, outline, error panel
│   │       │   └── HistoryScreen.tsx  # Compile history modal
│   │       ├── config.ts          # LocalStorage keys and runtime config
│   │       ├── template.ts        # Default LaTeX template
│   │       ├── types.ts           # App types
│   │       └── utils.ts          # File naming, parse history, parse outline, download helper
│   ├── blake3-fallback.ts        # Vite fallback for blake3 dependency resolution
│   ├── main.tsx                  # App bootstrap and Monaco worker setup
│   ├── styles.css                # Application styling and theme tokens
│   └── vite-env.d.ts            # Vite type declarations
└── dist/                         # Production build output generated via `npm run build`
```

## Important runtime and browser requirements

This project depends on WebAssembly and cross-origin isolation. The browser must support the following conditions:

- `SharedArrayBuffer` available
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

Without these headers, the app cannot initialize the Siglum runtime and compile PDFs in the browser. That is why the repo includes Vite dev headers and deployment config for both Vercel and Netlify.

## How compilation works

### Initialization
When the user clicks Compile, the app does the following:

1. Checks that the page is cross-origin isolated
2. Creates a single Siglum compiler instance if it is not already initialized
3. Loads the engine runtime and worker assets
4. Initializes the compiler

### PDF generation
Once initialized, the app calls:

```ts
compiler.compile(source, {
  engine: 'pdflatex',
  useCache: true,
});
```

If compilation succeeds:
- the PDF is converted to a Blob
- a browser object URL is created
- the preview is refreshed
- the file is recorded in compile history
- the previous successful PDF is replaced only after success

If compilation fails:
- the error panel is opened
- the fatal log line and final log lines are surfaced
- the previous compiled PDF remains available

## Local development

### Prerequisites
- Node.js 18+ recommended
- A modern browser with WebAssembly and `SharedArrayBuffer` support

### Install and run

```bash
npm install
npm run dev
```

This project starts a Vite development server. During install, it runs the postinstall step to copy Siglum's worker and XZ decompressor into `public/` and patch the worker for better package detection and font handling.

### Development server behavior
The Vite dev server does two important things:

- sets the required COOP/COEP headers for browser engine operation
- exposes a proxy route at `/api/texlive/:package` that fetches TeX Live archives from the public archive used by the project

This lets the browser fetch missing TeX packages during development when they are not already present in the Siglum bundle set.

## Environment configuration

The app supports one environment variable:

- `VITE_SIGLUM_CTAN_PROXY_URL`

### Purpose
This variable points to the root URL of a deployed CTAN package proxy that exposes a route like:

```text
/api/texlive/:package
```

This is required for production deployments when documents depend on TeX packages not included in Siglum's bundled packages.

### Example

```bash
VITE_SIGLUM_CTAN_PROXY_URL=https://example.com
```

Notes:
- do not include `/api/texlive` in the root URL itself; the engine appends that path automatically
- in local development, the app will use the built-in Vite proxy route if no value is set or if the configured value is a localhost proxy URL

## Build and deployment

### Production build

```bash
npm run build
```

This builds the Vite app and produces a static `dist` directory.

### Deployment targets
The project is already prepared for deployment to:
- Vercel
- Netlify

Relevant deployment config includes:
- `vercel.json`
- `netlify.toml`
- required headers for cross-origin isolation

### Deployment notes
For static deployments, the Siglum CDN assets must remain accessible with compatible CORS/CORP headers. If the deployed app needs packages outside Siglum's bundle set, you must deploy a proxy service that exposes `/api/texlive/:package` and set `VITE_SIGLUM_CTAN_PROXY_URL` to its root URL before building.

## State and persistence model

The app is mostly stateful within the browser and uses a small number of persisted keys:

- `resume-editor:source` — current LaTeX source
- `resume-editor:document-name` — active file name without extension
- `resume-editor:compile-history` — saved compile snapshots
- `theme-mode` — light or dark mode

Compiler and document caches are also managed by the engine itself, and Siglum stores package/document cache data in IndexedDB when available.

## Source file and UI behavior

### Editor pane
- Shows the document name in the title bar
- Includes an inline rename flow
- Provides zoom controls for the code editor
- Includes an outline sidebar and a placeholder files panel
- Has a footer reporting UTF-8 and line count
- Displays compile errors beneath the editor when compilation fails

### Header bar
Actions available in the top toolbar include:
- compile
- toggle light/dark mode
- undo
- redo
- download `.tex`
- download `.pdf`
- open compile history

### Preview pane
- Shows the compiled PDF
- Allows document page changes
- Shows page count and zoom value
- Provides fit controls and fullscreen mode
- Shows a loading state while the PDF is being prepared

## Error handling

The app treats LaTeX compilation failures as part of the normal authoring cycle.

Behavior:
- previous PDF is preserved when compile fails
- the error panel is shown with the fatal line and trailing log lines
- logs are aggregated from both compiler output and the generated TeX log
- if no CTAN proxy is configured, the error panel hints about configuring one for missing package resolution

This makes the editor useful even when a document fails to compile, because users can inspect the exact issue without losing the last working version.

## File naming and sanitization

The app normalizes filenames by:
- trimming whitespace
- removing `.tex` suffix when present
- replacing invalid filesystem characters such as `/`, `:`, `?`, `*`, and other forbidden characters with `-`
- removing trailing periods/spaces

This is implemented in `normalizeDocumentName` so the output file names remain safe for browsers and downloads.

## Default template

The default LaTeX template in `src/features/resume-editor/template.ts` is a one-page technical resume example that includes:
- contact header with phone, email, LinkedIn, and GitHub links
- skill categories
- experience section
- projects section
- education section

The template is intentionally production-ready for a developer-focused resume and can be edited freely.

## Notable implementation details

### Patching Siglum worker
The custom install script `scripts/copy-siglum-worker.mjs` patches the upstream Siglum worker to improve package and font detection. It does things such as:
- handling missing OpenType / TrueType font upload patterns
- resolving FontAwesome5 package names correctly
- mapping `helvetic` and related fonts to TeX package fetches
- collecting compile log output more reliably

This is necessary because the browser environment needs custom logic to fetch fonts and packages that may not be included in the shipped bundles.

### Vite and proxy settings
`vite.config.ts` configures:
- cross-origin isolation headers for dev mode
- `vite-plugin-wasm` for WebAssembly support
- an in-memory proxy endpoint for TeX packages at `/api/texlive/:package`
- aliasing for a BLAKE3 fallback to avoid missing generated glue during build

### Styling approach
The app uses:
- Tailwind base utilities
- a large custom CSS layer in `src/styles.css`
- CSS variables for themeing and layout states
- a split-pane workbench layout with resizable editor/preview divider

## Known limitations and caveats

- The app is browser-only and therefore dependent on browser capabilities.
- Cross-origin isolation is mandatory for compilation; if headers are missing, compilation fails.
- The files panel in the sidebar is not yet a true multi-file project manager; it is a placeholder.
- Compile history is stored in the browser only, not in a remote database.
- The app's TeX package support depends on the Siglum bundle set and optional CTAN proxy configuration.
- The project is primarily intended for editing a single LaTeX resume source rather than a complex multi-document LaTeX project.

## Summary

LetXBuilder is a polished, browser-based LaTeX resume authoring experience that combines:
- a high-quality editor
- real-time compile and preview
- helpful error reporting
- easy downloads
- a strong deployment setup for static hosting

It is most useful for individuals or teams that want a fast, local-first way to create resume content in LaTeX without managing a separate backend or installation-heavy environment.

## Quick reference

```bash
npm install
npm run dev
npm run build
```

Relevant environment variable:

```bash
VITE_SIGLUM_CTAN_PROXY_URL=https://your-proxy-root
```

Relevant deployment requirement:

- COOP = same-origin
- COEP = require-corp

## License

This project does not currently declare a license file in the repository. Check the repository root for any licensing status before using it in production or redistributing it.
