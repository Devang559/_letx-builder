export type CompileFailure = {
  message: string;
  firstFatal: string;
  lastLines: string[];
};

export type SavedPosition = { page: number; offset: number };

export type OutlineHeading = {
  title: string;
  line: number;
  depth: number;
};

export type CompileHistoryEntry = {
  id: string;
  documentName: string;
  source: string;
  compiledAt: string;
};
