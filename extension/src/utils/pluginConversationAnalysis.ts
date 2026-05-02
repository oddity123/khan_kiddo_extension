/**
 * 插件流式分析：POST /conversation/api/plugin/analyze/stream（SSE）
 * 与 `khan_kiddo/docs/api-conversation-plugin.md` 对齐。
 */

export interface ConversationAnalysisProgress {
  status: string;
  message?: string;
  result?: ConversationAnalysisResponse | null;
  errorMessage?: string | null;
}

export interface PluginAnalysisErrorItem {
  type: string;
  point: string;
  errorLevel?: string;
}

export interface PluginAnalysisItem {
  originalSentence: string;
  suggestion: string;
  errors?: PluginAnalysisErrorItem[];
}

export interface ConversationAnalysisResponse {
  analysisId?: string;
  analysisType?: string;
  status?: string;
  analyzedAt?: string;
  processingTimeMs?: number;
  analysisContent?: string;
  analysisResults?: {
    items?: PluginAnalysisItem[];
    totalSentences?: number;
    totalErrors?: number;
    educationalSummary?: unknown;
  };
  errorMessage?: string | null;
}

const PLUGIN_ANALYZE_PATH = "/conversation/api/plugin/analyze/stream";

export function buildPluginAnalyzeStreamUrl(origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${PLUGIN_ANALYZE_PATH}`;
}

export type ValidatedUserMessages =
  | { ok: true; userMessages: string[] }
  | { ok: false; error: string };

/**
 * 与后端 `validatePluginAnalysisRequest` 对齐的客户端预检，减少无效请求。
 */
export function validateUserMessagesForPlugin(raw: string[]): ValidatedUserMessages {
  if (!raw || raw.length === 0) {
    return { ok: false, error: "用户消息列表不能为空。" };
  }

  const userMessages = raw
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0);

  if (userMessages.length === 0) {
    return { ok: false, error: "有效用户消息为空。" };
  }

  for (const msg of userMessages) {
    if (msg.length > 5000) {
      return { ok: false, error: "单条用户消息不能超过 5000 个字符。" };
    }
  }

  const totalLen = userMessages.reduce((sum, s) => sum + s.length, 0);
  if (totalLen <= 10) {
    return { ok: false, error: "合并后的有效消息总长度需大于 10 个字符。" };
  }
  if (totalLen > 10000) {
    return { ok: false, error: "合并后的有效消息总长度不能超过 10000 个字符。" };
  }

  return { ok: true, userMessages };
}

function extractSseDataPayload(block: string): string | null {
  const lines = block.split("\n");
  let dataLine = "";
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("data:")) {
      const chunk = t.slice(5).trimStart();
      dataLine = dataLine ? `${dataLine}\n${chunk}` : chunk;
    }
  }
  return dataLine || null;
}

export async function consumePluginAnalyzeStream(
  origin: string,
  userMessages: string[],
  onProgress?: (progress: ConversationAnalysisProgress) => void
): Promise<ConversationAnalysisResponse> {
  const url = buildPluginAnalyzeStreamUrl(origin);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    },
    credentials: "include",
    body: JSON.stringify({ userMessages })
  });

  if (!res.ok) {
    const bodyPreview = await res.text().catch(() => "");
    const tail = bodyPreview.replace(/\s+/g, " ").trim().slice(0, 280);
    throw new Error(
      tail ? `KhanKiddo：请求失败（HTTP ${res.status}）：${tail}` : `KhanKiddo：请求失败（HTTP ${res.status}）。`
    );
  }

  if (!res.body) {
    throw new Error("KhanKiddo：响应体不可读。");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const block of parts) {
      const dataLine = extractSseDataPayload(block);
      if (!dataLine) continue;

      let progress: ConversationAnalysisProgress;
      try {
        progress = JSON.parse(dataLine) as ConversationAnalysisProgress;
      } catch {
        continue;
      }

      onProgress?.(progress);

      if (progress.status === "COMPLETED") {
        if (progress.result) return progress.result;
        throw new Error("KhanKiddo：分析已完成但未返回 result。");
      }

      if (progress.status === "ERROR") {
        throw new Error(progress.errorMessage || "分析失败");
      }
    }
  }

  throw new Error("KhanKiddo：流已结束，但未收到完成状态。");
}
