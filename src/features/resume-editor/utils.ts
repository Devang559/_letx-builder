import type { CompileFailure, CompileHistoryEntry, OutlineHeading } from "./types";

const SECTION_COMMAND_DEPTH: Record<string, number> = {
  part: 0,
  chapter: 0,
  section: 0,
  subsection: 1,
  subsubsection: 2,
  paragraph: 3,
  subparagraph: 4,
};

export function normalizeDocumentName(value: string): string {
  const name = value
    .trim()
    .replace(/\.tex$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/g, "");
  return name || "resume";
}

export function parseCompileFailure(log: string, message: string): CompileFailure {
  const lines = log.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const fatal = lines.find((line) => /^!\s/.test(line)) ?? message;
  return {
    message,
    firstFatal: fatal,
    lastLines: lines.slice(-5),
  };
}

export function parseCompileHistory(value: string | null): CompileHistoryEntry[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error("Saved compile history has an invalid format.");
  }
  return parsed.filter(
    (entry): entry is CompileHistoryEntry =>
      typeof entry === "object" &&
      entry !== null &&
      "id" in entry &&
      typeof entry.id === "string" &&
      "documentName" in entry &&
      typeof entry.documentName === "string" &&
      "source" in entry &&
      typeof entry.source === "string" &&
      "compiledAt" in entry &&
      typeof entry.compiledAt === "string",
  );
}

export function parseOutline(source: string): OutlineHeading[] {
  const uncommentedSource = source
    .split(/\r?\n/)
    .map((line) => {
      for (let index = 0; index < line.length; index += 1) {
        if (line[index] !== "%") continue;
        let precedingBackslashes = 0;
        for (let previous = index - 1; previous >= 0 && line[previous] === "\\"; previous -= 1) {
          precedingBackslashes += 1;
        }
        if (precedingBackslashes % 2 === 0) {
          return `${line.slice(0, index)}${" ".repeat(line.length - index)}`;
        }
      }
      return line;
    })
    .join("\n");
  const commandPattern =
    /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?(?:\s*\[[^\]]*\])?\s*\{/g;
  const headings: OutlineHeading[] = [];
  let match: RegExpExecArray | null;

  while ((match = commandPattern.exec(uncommentedSource)) !== null) {
    const openingBrace = commandPattern.lastIndex - 1;
    let depth = 1;
    let closingBrace = openingBrace + 1;

    for (; closingBrace < uncommentedSource.length && depth > 0; closingBrace += 1) {
      const character = uncommentedSource[closingBrace];
      if (character !== "{" && character !== "}") continue;
      let precedingBackslashes = 0;
      for (
        let previous = closingBrace - 1;
        previous > openingBrace && uncommentedSource[previous] === "\\";
        previous -= 1
      ) {
        precedingBackslashes += 1;
      }
      if (precedingBackslashes % 2 === 1) continue;
      if (character === "{") depth += 1;
      else depth -= 1;
    }

    if (depth !== 0) continue;
    const rawTitle = uncommentedSource.slice(openingBrace + 1, closingBrace - 1);
    const title = rawTitle
      .replace(/\\(?:textbf|textit|emph|underline|textrm|textsf|texttt|mbox)\s*/g, "")
      .replace(/[{}]/g, "")
      .replace(/\\&/g, "&")
      .replace(/\\\\/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (title) {
      headings.push({
        title,
        line: uncommentedSource.slice(0, match.index).split("\n").length,
        depth: SECTION_COMMAND_DEPTH[match[1]],
      });
    }
    commandPattern.lastIndex = closingBrace;
  }

  return headings;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
