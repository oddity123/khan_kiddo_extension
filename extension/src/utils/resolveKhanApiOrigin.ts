const STORAGE_KEY = "khanApiOrigin";

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
