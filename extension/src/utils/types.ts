export type AnalysisType = "grammar" | "expression";

export interface AnalysisErrorPoint {
  type: string;
  point: string;
  errorLevel?: string;
}

export interface SelectedTextItem {
  id: string;
  text: string;
  sourceTag: string;
}

export interface AnalysisResult {
  original: string;
  suggestion: string;
  type: AnalysisType;
  /** 句子级错误点（来自后端 `analysisResults.items[].errors`） */
  errors?: AnalysisErrorPoint[];
}

export type RuntimeMessage =
  | { type: "SELECTIONS_UPDATED"; payload: SelectedTextItem[] }
  | { type: "REQUEST_SELECTIONS" }
  | { type: "REMOVE_SELECTION"; payload: { id: string } }
  | { type: "CLEAR_ALL_SELECTIONS" }
  | { type: "ANALYZE_TEXTS"; payload: string[] };
