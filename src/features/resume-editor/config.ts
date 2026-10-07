export const STORAGE_KEY = "resume-editor:source";
export const DOCUMENT_NAME_KEY = "resume-editor:document-name";
export const COMPILE_HISTORY_KEY = "resume-editor:compile-history";
export const SIGLUM_BASE = "https://cdn.siglum.org/tl2025";
const configuredProxyUrl = import.meta.env.VITE_SIGLUM_CTAN_PROXY_URL?.trim().replace(/\/+$/, "");
const legacyLocalProxyUrls = new Set(["http://localhost:8081", "http://127.0.0.1:8081"]);

export const CTAN_PROXY_URL =
  import.meta.env.DEV &&
  (!configuredProxyUrl || legacyLocalProxyUrls.has(configuredProxyUrl))
    ? window.location.origin
    : configuredProxyUrl;
