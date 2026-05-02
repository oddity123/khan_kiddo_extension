import { backgroundStrings } from "../utils/branding";
import type { AnalysisResult } from "../utils/types";

function createMockSuggestion(input: string, index: number): AnalysisResult {
  const type = index % 2 === 0 ? "grammar" : "expression";
  const suggestion =
    type === "grammar"
      ? `语法可再收紧：「${input.slice(0, 64)}${input.length > 64 ? "…" : ""}」可改写得更易读。`
      : `表达可更生动：围绕「${input.slice(0, 64)}${input.length > 64 ? "…" : ""}」换种说法，语气会更自然。`;

  return {
    original: input,
    suggestion,
    type
  };
}

async function mockAnalyzeBatch(texts: string[]): Promise<AnalysisResult[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(texts.map((text, index) => createMockSuggestion(text, index)));
    }, 900);
  });
}

chrome.runtime.onMessage.addListener((message: { type: string; payload?: unknown }, _, sendResponse) => {
  if (message.type !== "ANALYZE_TEXTS") return false;

  const texts = (message.payload as string[] | undefined) ?? [];
  mockAnalyzeBatch(texts)
    .then((results) => sendResponse({ results }))
    .catch((error: unknown) =>
      sendResponse({
        error: error instanceof Error ? error.message : backgroundStrings.analyzeUnknownError
      })
    );

  return true;
});
