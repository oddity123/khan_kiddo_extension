/**
 * 豆包对话页 DOM 路径配置（消息查找、用户/AI 判定、去重等）。
 * 页面改版时优先改此文件；内容脚本仅此入口引用，打包会并入 content.js，避免拆 chunk。
 *
 * 控制台自测：复制仓库内 `extension/scripts/doubao-dom-probe.console.js` 全文到豆包页 DevTools → Console 执行。
 */

export const DOUBAO_HOSTNAME_REGEX = /(^|\.)doubao\.com$/i;

/** `data-testid` 字面量（不含方括号） */
export const DOUBAO_TESTIDS = {
  sendMessage: "send_message",
  receiveMessage: "receive_message",
  unionMessage: "union_message",
  messageTextContent: "message_text_content"
} as const;

export function dataTestIdSelector(testId: string): string {
  return `[data-testid="${testId}"]`;
}

/** 用户/AI 判定：`closest` 用 */
export const DOUBAO_SEND_MESSAGE_ROOT = dataTestIdSelector(DOUBAO_TESTIDS.sendMessage);
export const DOUBAO_RECEIVE_MESSAGE_ROOT = dataTestIdSelector(DOUBAO_TESTIDS.receiveMessage);

/** 扫描与注入：与历史油猴/早期逻辑对应的选择器集合 */
export const DOUBAO_DOM = {
  /** 单条联合消息外层 */
  unionMessage: `div${dataTestIdSelector(DOUBAO_TESTIDS.unionMessage)}`,
  /** 发送/接收回退容器（逗号分隔） */
  sendOrReceiveMessage: `div${dataTestIdSelector(DOUBAO_TESTIDS.sendMessage)}, div${dataTestIdSelector(DOUBAO_TESTIDS.receiveMessage)}`,
  /** 正文节点（在 union/send/receive 内查找） */
  messageTextContent: `div${dataTestIdSelector(DOUBAO_TESTIDS.messageTextContent)}`,
  /**
   * 仅在开启 `localStorage.__AI_BATCH_DEBUG__ = "1"` 时作为备选内容节点（易误匹配，勿默认开启）。
   */
  altContentRescue:
    '[data-testid*="message"][data-testid*="content"], [data-testid*="content"][data-testid*="text"], [class*="message"][class*="content"]',
  /** `closest` 推断消息根时的候选 */
  messageRootKnown: `div${dataTestIdSelector(DOUBAO_TESTIDS.unionMessage)}, div${dataTestIdSelector(DOUBAO_TESTIDS.sendMessage)}, div${dataTestIdSelector(DOUBAO_TESTIDS.receiveMessage)}, article, [class*="message-item"]`,
  /** 用户气泡（class 路径，与 testid 路径二选一/互补） */
  userBubble: "div.bg-g-send-msg-bubble-bg.whitespace-pre-wrap.wrap-anywhere",
  /** 历史油猴残留，去重时移除 */
  legacyTampermonkeyCheckbox: ".gm-message-checkbox-container, input.gm-message-checkbox"
} as const;

export const DOUBAO_MIN_TEXT_LENGTH = 2;
