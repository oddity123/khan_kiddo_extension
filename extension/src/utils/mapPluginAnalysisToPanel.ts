import type { AnalysisResult, AnalysisType } from "./types";
import type { ConversationAnalysisResponse, PluginAnalysisItem } from "./pluginConversationAnalysis";

function inferBadgeType(errors: PluginAnalysisItem["errors"]): AnalysisType {
  if (!errors?.length) return "expression";
  const grammarish = errors.some(
    (e) => e.errorLevel === "FATAL" || e.errorLevel === "BASIC"
  );
  return grammarish ? "grammar" : "expression";
}

export function mapPluginAnalysisResponseToPanelResults(
  response: ConversationAnalysisResponse
): AnalysisResult[] {
  const items = response.analysisResults?.items ?? [];
  return items.map((item) => ({
    original: item.originalSentence ?? "",
    suggestion: item.suggestion ?? "",
    type: inferBadgeType(item.errors),
    errors: item.errors?.map((e) => ({
      type: e.type,
      point: e.point,
      errorLevel: e.errorLevel
    }))
  }));
}
