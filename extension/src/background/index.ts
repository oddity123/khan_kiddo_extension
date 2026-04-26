import type { AnalysisResult } from "../utils/types";

function createMockSuggestion(input: string, index: number): AnalysisResult {
  const type = index % 2 === 0 ? "grammar" : "expression";
  const suggestion =
    type === "grammar"
      ? `Consider tightening grammar: "${input.slice(0, 64)}..." can be simplified for readability.`
      : `Try a more vivid phrasing for: "${input.slice(0, 64)}..." to improve tone.`;

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
      sendResponse({ error: error instanceof Error ? error.message : "Unknown analysis error" })
    );

  return true;
});
