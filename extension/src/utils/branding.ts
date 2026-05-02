/** 与仓库 / 产品名一致，所有用户可见标题与说明围绕此品牌。 */
export const BRAND_NAME = "KhanKiddo";

/** `manifest.json` 的 `name` 字段（Chrome 扩展列表标题） */
export const EXTENSION_NAME = BRAND_NAME;

/** `manifest.json` 的 `description` */
export const EXTENSION_DESCRIPTION =
  "KhanKiddo：在豆包对话中勾选你的用户消息，于侧栏批量整理并用 KhanKiddo 发起分析。";

/** `sidepanel.html` 的 `<title>` */
export const SIDE_PANEL_DOCUMENT_TITLE = BRAND_NAME;

export const sidePanel = {
  headerEyebrow: BRAND_NAME,
  headerTitle: "对话勾选与批量分析",
  headerDescription:
    "由 KhanKiddo 在侧栏汇总已选用户消息并发起分析。请先在页面勾选消息旁的复选框；列表过长时在区域内滚动。",
  analyzeButton: "用 KhanKiddo 分析",
  analyzing: "KhanKiddo 分析中…",
  analyzeFailedOriginal: "KhanKiddo 分析失败",
  analyzeFailedFallback: "KhanKiddo 后台出现未知错误，请稍后重试。"
} as const;

export const selectedPanel = {
  sectionTitle: "已选片段",
  clearAll: "一键清除",
  emptyHint: "暂无选中内容。请在对话里勾选用户消息旁的 KhanKiddo 复选框。",
  removeAria: "从 KhanKiddo 已选中移除",
  removeTitle: "移除"
} as const;

export const resultsPanel = {
  sectionTitle: "KhanKiddo 分析结果",
  emptyHint: "分析结果将显示在此处。"
} as const;

/**
 * 页面内容脚本请勿 `import` 本文件：Rollup 会打成独立 chunk，Chrome 注入 content script
 * 时不是 ES module，会导致 `Cannot use import statement outside a module`。
 * 与 `content/index.ts` 内 `contentScriptUi` 保持同步。
 */
export const contentScript = {
  checkboxTitle: "勾选以加入 KhanKiddo 批量分析",
  bulkAriaLabel: "KhanKiddo：选择以下全部对话",
  bulkTitle:
    "KhanKiddo · 选择以下全部对话：从本条起选中下方全部已注入复选框的用户消息（含本条，会先清空当前已选）。",
  bulkLabelLong: "选择以下全部对话"
} as const;

export const backgroundStrings = {
  analyzeUnknownError: "KhanKiddo：分析过程出现未知错误"
} as const;
