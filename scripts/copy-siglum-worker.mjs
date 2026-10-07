import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/@siglum/engine/src/worker.js");
const destination = resolve(root, "public/worker.js");
const xzSource = resolve(root, "node_modules/xzwasm/dist/package/xzwasm.min.js");
const xzDestination = resolve(root, "public/xzwasm.min.js");

mkdirSync(dirname(destination), { recursive: true });
let worker = readFileSync(source, "utf8");

const replacements = [
  [
    String.raw`        /! Font [^=]+=([a-z0-9-]+) at .* not loadable: Metric \(TFM\) file/g,`,
    String.raw`        /! Font [^=]+=\[([^\]]+\.(?:otf|ttf))\]/gi,` +
      "\n" +
      String.raw`        /kpathsea: Running mktextfm ([a-z0-9-]+)/gi,` +
      "\n" +
      String.raw`        /! Font [^=]+=([a-z0-9-]+) at .* not loadable: Metric \(TFM\) file/g,`,
  ],
  [
    "function getPackageFromFile(filename) {\n    const fontPkg = getFontPackage(filename);",
    "function getPackageFromFile(filename) {\n" +
      "    const baseName = filename.split(/[\\\\/]/).pop() || filename;\n" +
      "    if (/^FontAwesome5(?:Free|Brands)-/i.test(baseName)) return 'fontawesome5';\n" +
      "    const fontPkg = getFontPackage(baseName);",
  ],
  [
    "    const baseName = fontName.replace(/\\.(pfb|tfm)$/i, '');",
    "    const baseName = (fontName.split(/[\\\\/]/).pop() || fontName).replace(/\\.(pfb|tfm)$/i, '');\n" +
      "    if (/^fa5(?:free|brands)/i.test(baseName)) return 'fontawesome5';",
  ],
  [
    "    // Fallback: Latin Modern patterns for CTAN fetch (when not in local bundles)\n" +
      "    if (/^(rm|cs|ec|ts|qx|t5|l7x)-?lm/.test(baseName)) return 'lm';",
    "    // Fallback: Latin Modern patterns for CTAN fetch (when not in local bundles)\n" +
      "    if (/^(rm|cs|ec|ts|qx|t5|l7x)-?lm/.test(baseName)) return 'lm';\n" +
      "    if (/^phv[a-z0-9-]*$/i.test(baseName)) return 'helvetic';",
  ],
  [
    "                            if (bundleName && !bundleDataMap.has(bundleName)) {\n" +
      "                                bundlesToFetch.push({ missingFile, pkgName, bundleName });\n" +
      "                            } else if (!bundleName) {\n" +
      "                                ctanToFetch.push({ missingFile, pkgName });\n" +
      "                            }",
    "                            if (/\\.(otf|ttf)$/i.test(missingFile) || /^fa5(?:free|brands)/i.test(missingFile)) {\n" +
      "                                ctanToFetch.push({ missingFile, pkgName });\n" +
      "                            } else if (bundleName && !bundleDataMap.has(bundleName)) {\n" +
      "                                bundlesToFetch.push({ missingFile, pkgName, bundleName });\n" +
      "                            } else if (!bundleName) {\n" +
      "                                ctanToFetch.push({ missingFile, pkgName });\n" +
      "                            }",
  ],
  [
    "    let lastExitCode = -1;\n" +
      "    let Module = null;",
    "    let lastExitCode = -1;\n" +
      "    let lastCompileOutput = '';\n" +
      "    let Module = null;",
  ],
  [
    "            lastExitCode = result.exit_code;",
    "            lastCompileOutput = [result.stdout, result.stderr].filter(Boolean).join('\\n');\n" +
      "            lastExitCode = result.exit_code;",
  ],
  [
    "    // Help GC by clearing references we no longer need\n" +
      "    // The Module/FS will be recreated on next compile anyway\n" +
      "    Module = null;",
    "    let failureLog = '';\n" +
      "    if (!compileSuccess && FS) {\n" +
      "        try { failureLog = FS.readFile('/document.log', { encoding: 'utf8' }); } catch (e) {}\n" +
      "        failureLog = [failureLog, lastCompileOutput].filter(Boolean).join('\\n');\n" +
      "    }\n" +
      "\n" +
      "    // Help GC by clearing references we no longer need\n" +
      "    // The Module/FS will be recreated on next compile anyway\n" +
      "    Module = null;",
  ],
  [
    "            exitCode: lastExitCode,\n" +
      "            auxFilesToCache: auxFiles,",
    "            exitCode: lastExitCode,\n" +
      "            error: compileSuccess ? undefined : `TeX exited with code ${lastExitCode}`,\n" +
      "            log: failureLog,\n" +
      "            auxFilesToCache: auxFiles,",
  ],
  [
    "            exitCode: lastExitCode,\n" +
      "            auxFilesToCache: auxFiles,",
    "            exitCode: lastExitCode,\n" +
      "            error: compileSuccess ? undefined : `TeX exited with code ${lastExitCode}`,\n" +
      "            log: failureLog,\n" +
      "            auxFilesToCache: auxFiles,",
  ],
];

for (const [original, replacement] of replacements) {
  if (!worker.includes(original)) {
    throw new Error("Siglum worker did not match the expected font-fetch patch location.");
  }
  worker = worker.replace(original, replacement);
}

writeFileSync(destination, worker);
copyFileSync(xzSource, xzDestination);
console.info("Copied Siglum worker and XZ decompressor into public/");
