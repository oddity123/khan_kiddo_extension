const STORAGE_KEY = "khanApiOrigin";
const STORAGE_LOGIN_URL_KEY = "khanLoginUrl";

function trimOrigin(input: string): string {
  return input.trim().replace(/\/+$/, "");
}

/**
 * 优先 `chrome.storage.local.khanApiOrigin`，否则构建期 `VITE_KHAN_API_ORIGIN`。
 */
export async function resolveKhanApiOrigin(): Promise<string | null> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const fromStorage = typeof stored[STORAGE_KEY] === "string" ? trimOrigin(stored[STORAGE_KEY] as string) : "";
    if (fromStorage) return fromStorage;
  } catch {
    // storage 不可用时忽略
  }

  const fromEnv = typeof import.meta.env.VITE_KHAN_API_ORIGIN === "string"
    ? trimOrigin(import.meta.env.VITE_KHAN_API_ORIGIN)
    : "";
  return fromEnv || null;
}

/**
 * 登录页 URL：优先 `chrome.storage.local.khanLoginUrl`（完整 URL），
 * 其次 `VITE_KHAN_LOGIN_URL`，否则为 `{应用根}{VITE_KHAN_LOGIN_PATH|/login}`。
 */
export async function resolveKhanLoginUrl(apiOrigin: string): Promise<string> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_LOGIN_URL_KEY);
    const fromStorage =
      typeof stored[STORAGE_LOGIN_URL_KEY] === "string" ? (stored[STORAGE_LOGIN_URL_KEY] as string).trim() : "";
    if (fromStorage) return fromStorage;
  } catch {
    // ignore
  }

  const envFull =
    typeof import.meta.env.VITE_KHAN_LOGIN_URL === "string" ? import.meta.env.VITE_KHAN_LOGIN_URL.trim() : "";
  if (envFull) return envFull;

  const envPathRaw =
    typeof import.meta.env.VITE_KHAN_LOGIN_PATH === "string"
      ? import.meta.env.VITE_KHAN_LOGIN_PATH.trim()
      : "/login";
  const path = envPathRaw.startsWith("/") ? envPathRaw : `/${envPathRaw}`;
  const base = apiOrigin.replace(/\/+$/, "");
  return `${base}${path}`;
}
