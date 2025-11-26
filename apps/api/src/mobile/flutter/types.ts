export type FlutterControlMeta = {
  id?: string;
  method?: string | null;
  handler?: string | null;
  label?: string | null;
  rawLabel?: string | null;
  labelSource?: string | null;
  labelLocaleKey?: string | null;
  translations?: Record<string, string> | null;
  language?: string | null;
  platform?: string | null;
  selectorType?: string | null;
  selector?: string | null;
  targetRoute?: string | null;
  targetPageClass?: string | null;
  description?: string | null;
  sourceFileLine?: number | null;
};

export type FlutterPageMeta = {
  pageClass: string;
  pageFile: string;
  controls: FlutterControlMeta[];
  isEntry?: boolean;
  platform?: string | null;
};

export type FlutterMeta = {
  branch?: string;
  sanitizedBranch?: string;
  generatedAt?: string;
  flutterRoot?: string;
  platform?: string;
  language?: string;
  entryPageClass?: string | null;
  pages: FlutterPageMeta[];
};
