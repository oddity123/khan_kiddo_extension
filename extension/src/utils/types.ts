export type AnalysisType = "grammar" | "expression";

export interface SelectedTextItem {
  id: string;
  text: string;
  sourceTag: string;
}

export interface AnalysisResult {
  original: string;
  suggestion: string;
  type: AnalysisType;
}

export type RuntimeMessage =
  | { type: "SELECTIONS_UPDATED"; payload: SelectedTextItem[] }
  | { type: "REQUEST_SELECTIONS" }
  | { type: "REMOVE_SELECTION"; payload: { id: string } }
  | { type: "CLEAR_ALL_SELECTIONS" }
  | { type: "ANALYZE_TEXTS"; payload: string[] };
