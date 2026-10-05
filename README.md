# Resume Studio

A frontend-only LaTeX resume editor built with React, Vite, TypeScript, Monaco, Siglum's WebAssembly TeX Live engine, and PDFSlick.

## Development

```sh
npm install
npm run dev
```

`npm install` copies Siglum's worker into `public/worker.js`. Vite's development and preview servers send the cross-origin isolation headers required by `SharedArrayBuffer`.

## Browser compilation and deployment

Compilation uses XeLaTeX in the browser. Siglum fetches its runtime and package bundles from `cdn.siglum.org`; the first compile downloads the WASM runtime and can take longer than later compiles. The engine's document and package caches persist in IndexedDB.

The Vercel and Netlify configurations include the required COOP/COEP headers. Deploy the generated `dist` directory to either provider. The Siglum CDN assets must remain available with CORS/CORP headers compatible with cross-origin isolation.

To fetch packages not included in the Siglum package bundles, set `VITE_SIGLUM_CTAN_PROXY_URL` to a reachable, CORS-enabled Siglum-compatible CTAN proxy before building. The editor does not include a proxy server because the app has no backend.

## Features

- Monaco LaTeX editing with undo/redo and 500ms localStorage persistence.
- Explicit XeLaTeX compilation; failures preserve the previous successful PDF and display the fatal diagnostic plus the last five log lines.
- PDFSlick page navigation, zoom, fit-width/page, fullscreen, PDF download, and page/offset restoration on recompilation.
- Download the source as `resume.tex` and the latest successful PDF as `resume.pdf`.
