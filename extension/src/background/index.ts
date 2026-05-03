import { backgroundStrings } from "../utils/branding";
import {
  consumePluginAnalyzeStream,
  PluginSessionRequiredError,
  validateUserMessagesForPlugin
} from "../utils/pluginConversationAnalysis";
import { mapPluginAnalysisResponseToPanelResults } from "../utils/mapPluginAnalysisToPanel";
import { resolveKhanApiOrigin, resolveKhanLoginUrl } from "../utils/resolveKhanApiOrigin";
import type { AnalysisResult } from "../utils/types";

async function analyzeTextsWithBackend(texts: string[]): Promise<AnalysisResult[]> {
  const origin = await resolveKhanApiOrigin();
  if (!origin) {
    throw new Error(
      "未配置 KhanKiddo 后端地址：请在构建环境设置 VITE_KHAN_API_ORIGIN（应用根地址，如 https://your-host），或在扩展 storage.local 写入 khanApiOrigin。"
    );
  }

  const validated = validateUserMessagesForPlugin(texts);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const loginUrl = await resolveKhanLoginUrl(origin);
  const response = await consumePluginAnalyzeStream(origin, validated.userMessages, undefined, loginUrl);
  return mapPluginAnalysisResponseToPanelResults(response);
}

chrome.runtime.onMessage.addListener((message: { type: string; payload?: unknown }, _, sendResponse) => {
  if (message.type !== "ANALYZE_TEXTS") return false;

  const texts = (message.payload as string[] | undefined) ?? [];
  analyzeTextsWithBackend(texts)
    .then((results) => sendResponse({ results }))
    .catch((error: unknown) => {
      let messageText =
        error instanceof Error ? error.message : backgroundStrings.analyzeUnknownError;
      if (error instanceof PluginSessionRequiredError) {
        void chrome.tabs.create({ url: error.loginUrl });
        messageText = `${messageText} 已打开登录页。`;
      }
      sendResponse({ error: messageText });
    });

  return true;
});
