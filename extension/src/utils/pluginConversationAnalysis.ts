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

/** 判定为需要登录/补全会话时抛出，由 background 打开 {@link loginUrl} */
export class PluginSessionRequiredError extends Error {
  readonly loginUrl: string;

  constructor(message: string, loginUrl: string) {
    super(message);
    this.name = "PluginSessionRequiredError";
    this.loginUrl = loginUrl;
  }
}

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

function normalizeSseText(chunk: string): string {
  return chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** 判断是否为典型 HTML 页面片段（登录页、整页错误等），避免把标签/脚本原文展示给用户 */
function looksLikeHtmlPayload(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim().slice(0, 16000);
  if (!t) return false;
  if (/<!doctype\s+html\b|<html[\s>]/i.test(t)) return true;
  if (/<\/html>\s*$/i.test(t) && /<(head|body|script|meta|link|div)\b/i.test(t)) return true;
  if (/<script[^>]*src=[^>]*bootstrap|<\/body>\s*<\/html>/i.test(t)) return true;
  if (/<!--\s*Bootstrap JS\s*-->/i.test(t)) return true;
  if (/\bcharset=["']?utf-8["']?\s*\/?>\s*<title>/i.test(t)) return true;
  return false;
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

function parseProgressFromDataJson(dataLine: string): ConversationAnalysisProgress | null {
  try {
    return JSON.parse(dataLine) as ConversationAnalysisProgress;
  } catch {
    return null;
  }
}

/**
 * 处理缓冲区中所有「以空行分隔」的完整 SSE 帧，返回未凑齐最后一帧的尾部。
 */
function drainCompleteSseFrames(
  buffer: string,
  onProgress?: (progress: ConversationAnalysisProgress) => void
): { rest: string; completed?: ConversationAnalysisResponse; error?: string } {
  const normalized = normalizeSseText(buffer);
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";

  for (const block of parts) {
    const dataLine = extractSseDataPayload(block);
    if (!dataLine) continue;

    const progress = parseProgressFromDataJson(dataLine);
    if (!progress) continue;

    onProgress?.(progress);

    if (progress.status === "COMPLETED") {
      if (progress.result) return { rest, completed: progress.result };
      return { rest, error: "KhanKiddo：分析已完成但未返回 result。" };
    }

    if (progress.status === "ERROR") {
      return { rest, error: progress.errorMessage || "分析失败" };
    }
  }

  return { rest };
}

function tryParseTrailingSseBlock(
  tail: string,
  onProgress?: (progress: ConversationAnalysisProgress) => void
): { completed?: ConversationAnalysisResponse; error?: string } {
  const trimmed = normalizeSseText(tail).trim();
  if (!trimmed) return {};

  const dataLine = extractSseDataPayload(trimmed);
  if (!dataLine) return {};

  const progress = parseProgressFromDataJson(dataLine);
  if (!progress) return {};

  onProgress?.(progress);

  if (progress.status === "COMPLETED") {
    if (progress.result) return { completed: progress.result };
    return { error: "KhanKiddo：分析已完成但未返回 result。" };
  }
  if (progress.status === "ERROR") {
    return { error: progress.errorMessage || "分析失败" };
  }
  return {};
}

export async function consumePluginAnalyzeStream(
  origin: string,
  userMessages: string[],
  onProgress?: (progress: ConversationAnalysisProgress) => void,
  /** 未登录时用于 `chrome.tabs.create` 的登录页完整 URL */
  loginPageUrl?: string
): Promise<ConversationAnalysisResponse> {
  const loginTarget = loginPageUrl?.trim() || `${origin.replace(/\/+$/, "")}/login`;

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
    if (looksLikeHtmlPayload(bodyPreview)) {
      throw new PluginSessionRequiredError(`请先登录（HTTP ${res.status}）。`, loginTarget);
    }
    if (res.status === 401 || res.status === 403) {
      throw new PluginSessionRequiredError(`请先登录（HTTP ${res.status}）。`, loginTarget);
    }
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

    if (value && value.byteLength > 0) {
      buffer += decoder.decode(value, { stream: !done });
    }

    if (done) {
      buffer += decoder.decode();
      const drainedOnClose = drainCompleteSseFrames(buffer, onProgress);
      buffer = drainedOnClose.rest;
      if (drainedOnClose.error) throw new Error(drainedOnClose.error);
      if (drainedOnClose.completed) return drainedOnClose.completed;
      break;
    }

    const drained = drainCompleteSseFrames(buffer, onProgress);
    buffer = drained.rest;
    if (drained.error) throw new Error(drained.error);
    if (drained.completed) return drained.completed;
  }

  const finalDrained = drainCompleteSseFrames(buffer, onProgress);
  buffer = finalDrained.rest;
  if (finalDrained.error) throw new Error(finalDrained.error);
  if (finalDrained.completed) return finalDrained.completed;

  const trailing = tryParseTrailingSseBlock(buffer, onProgress);
  if (trailing.error) throw new Error(trailing.error);
  if (trailing.completed) return trailing.completed;

  const rawBuffer = normalizeSseText(buffer).trim();
  if (looksLikeHtmlPayload(rawBuffer)) {
    throw new PluginSessionRequiredError("请先登录。", loginTarget);
  }

  const tailPreview = rawBuffer.replace(/\s+/g, " ").slice(0, 200);
  throw new Error(
    tailPreview
      ? `分析未完成：未收到有效结果。若已登录仍出现，请检查网络或联系管理员。（技术摘要：${tailPreview}）`
      : "分析未完成：响应为空或格式异常。若已登录仍出现，请稍后重试。"
  );
}
