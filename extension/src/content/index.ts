import type { SelectedTextItem } from "../utils/types";

/**
 * 与 `utils/branding.ts` 中 `contentScript` 保持一致。
 * 内容脚本不能 import 该文件：Vite 会拆出 `chunks/branding-*.js`，而 Chrome 注入的 content script 非 module，顶层 `import` 会报错。
 */
const contentScriptUi = {
  checkboxTitle: "勾选以加入 KhanKiddo 批量分析",
  bulkAriaLabel: "KhanKiddo：选择以下全部对话",
  bulkTitle:
    "KhanKiddo · 选择以下全部对话：从本条起选中下方全部已注入复选框的用户消息（含本条，会先清空当前已选）。",
  bulkLabelLong: "选择以下全部对话"
} as const;

const SELECTABLE_SELECTOR = "p, div, span";
const MIN_TEXT_LENGTH = 24;
const MAX_TEXT_LENGTH = 480;
const DOUBAO_MIN_TEXT_LENGTH = 2;
const CONTROL_ATTR = "data-ai-batch-control";
const ID_ATTR = "data-ai-batch-id";
const HOST_ATTR = "data-ai-batch-host";
const NODE_ATTR = "data-ai-batch-node";
const BULK_INLINE_ATTR = "data-ai-batch-bulk-inline";
const LEGACY_BULK_TOP_BAR_ID = "ai-batch-bulk-top-bar";
const HIGHLIGHT_CLASS = "ai-batch-highlight";
const STYLE_ID = "ai-batch-style";
const DOUBAO_HOST_REGEX = /(^|\.)doubao\.com$/i;
const DOUBAO_UNION_SELECTOR = 'div[data-testid="union_message"]';
const DOUBAO_FALLBACK_SELECTOR = 'div[data-testid="send_message"], div[data-testid="receive_message"]';
const DOUBAO_CONTENT_SELECTOR = 'div[data-testid="message_text_content"]';
const DOUBAO_ALT_CONTENT_SELECTOR =
  '[data-testid*="message"][data-testid*="content"], [data-testid*="content"][data-testid*="text"], [class*="message"][class*="content"]';
const DOUBAO_MESSAGE_ROOT_SELECTOR =
  'div[data-testid="union_message"], div[data-testid="send_message"], div[data-testid="receive_message"], article, [class*="message-item"]';
const DOUBAO_USER_BUBBLE_SELECTOR = "div.bg-g-send-msg-bubble-bg.whitespace-pre-wrap.wrap-anywhere";
const LEGACY_TAMPERMONKEY_CHECKBOX_SELECTOR = ".gm-message-checkbox-container, input.gm-message-checkbox";
const DEBUG_FLAG_KEY = "__AI_BATCH_DEBUG__";
const MESSAGE_DEDUPE_VERTICAL_PX = 18;
const MESSAGE_DEDUPE_HORIZONTAL_PX = 80;
const PARENT_TEXT_EXPANSION_FACTOR = 2.5;
const PARENT_TEXT_EXPANSION_ABS = 500;
const HOST_WIDTH_RATIO_LIMIT = 0.75;

const selectedItems = new Map<string, SelectedTextItem>();
const checkboxById = new Map<string, HTMLInputElement>();
const trackedElements = new Set<HTMLElement>();
let nodeIdByElement = new WeakMap<HTMLElement, string>();
let nodeIdSeed = 0;
let scanTimer: number | undefined;
let emptyDoubaoScanStreak = 0;

function isDebugEnabled(): boolean {
  try {
    return window.localStorage.getItem(DEBUG_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function debugLog(...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  console.log("[ai-batch-debug]", ...args);
}

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function splitToChunks(rawText: string): string[] {
  return rawText
    .split(/(?<=[.!?;。！？；])\s+|\n+/)
    .map(normalizeText)
    .filter((chunk) => chunk.length >= MIN_TEXT_LENGTH && chunk.length <= MAX_TEXT_LENGTH);
}

function getNodeId(element: HTMLElement): string {
  const existing = nodeIdByElement.get(element);
  if (existing) return existing;

  const nextId = `node-${++nodeIdSeed}`;
  nodeIdByElement.set(element, nextId);
  element.setAttribute(NODE_ATTR, nextId);
  return nextId;
}

function createStableId(text: string, element: HTMLElement): string {
  const seed = `${location.hostname}-${getNodeId(element)}-${text.slice(0, 80)}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return `chunk-${Math.abs(hash)}`;
}

/** 列表 + 向下：表示从本条起选中下方批量。 */
function createBulkSelectBelowIconSvg(): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("aria-hidden", "true");

  const line = (x1: string, y1: string, x2: string, y2: string) => {
    const el = document.createElementNS(NS, "line");
    el.setAttribute("x1", x1);
    el.setAttribute("y1", y1);
    el.setAttribute("x2", x2);
    el.setAttribute("y2", y2);
    el.setAttribute("stroke", "currentColor");
    el.setAttribute("stroke-width", "2");
    el.setAttribute("stroke-linecap", "round");
    return el;
  };

  const dot = (cy: string) => {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", "4");
    c.setAttribute("cy", cy);
    c.setAttribute("r", "1.35");
    c.setAttribute("fill", "currentColor");
    return c;
  };

  svg.appendChild(dot("6"));
  svg.appendChild(dot("12"));
  svg.appendChild(dot("18"));
  svg.appendChild(line("8", "6", "20", "6"));
  svg.appendChild(line("8", "12", "20", "12"));
  svg.appendChild(line("8", "18", "16", "18"));

  const chevron = document.createElementNS(NS, "path");
  chevron.setAttribute("fill", "none");
  chevron.setAttribute("stroke", "currentColor");
  chevron.setAttribute("stroke-width", "2");
  chevron.setAttribute("stroke-linecap", "round");
  chevron.setAttribute("stroke-linejoin", "round");
  chevron.setAttribute("d", "M17 15l2 2 2-2");
  svg.appendChild(chevron);

  return svg;
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      background: rgba(59, 130, 246, 0.08);
      outline: 1px dashed rgba(59, 130, 246, 0.3);
      transition: background 0.15s ease-in-out;
    }
    [${CONTROL_ATTR}="wrapper"] {
      position: absolute;
      top: 4px;
      left: auto;
      right: 100%;
      margin-right: 6px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: flex-start;
      gap: 4px;
      width: auto;
      flex-shrink: 0;
    }
    button[${BULK_INLINE_ATTR}] {
      margin: 0;
      padding: 2px 4px;
      border: 1px solid rgba(203, 213, 225, 0.95);
      border-radius: 5px;
      background: rgba(248, 250, 252, 0.98);
      font-size: 10px;
      line-height: 1.25;
      color: #334155;
      cursor: pointer;
      white-space: nowrap;
    }
    button[${BULK_INLINE_ATTR}] .ai-batch-bulk-short {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    button[${BULK_INLINE_ATTR}] .ai-batch-bulk-short svg {
      display: block;
    }
    button[${BULK_INLINE_ATTR}] .ai-batch-bulk-long {
      display: none;
    }
    button[${BULK_INLINE_ATTR}]:hover .ai-batch-bulk-short {
      display: none;
    }
    button[${BULK_INLINE_ATTR}]:hover .ai-batch-bulk-long {
      display: inline;
    }
    button[${BULK_INLINE_ATTR}]:hover {
      border-color: #3b82f6;
      color: #1e40af;
      background: #eff6ff;
    }
    [${CONTROL_ATTR}="checkbox"] {
      margin: 0;
      accent-color: #3b82f6;
      cursor: pointer;
      width: 14px;
      height: 14px;
    }
    [${HOST_ATTR}="true"] {
      position: relative !important;
    }
  `;
  document.head.appendChild(style);
}

function isValidCandidate(element: HTMLElement): boolean {
  if (trackedElements.has(element)) return false;
  if (element.closest(`[${CONTROL_ATTR}]`)) return false;
  if (element.childElementCount > 3) return false;
  if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"].includes(element.tagName)) {
    return false;
  }
  if (
    element.closest(
      "a, button, nav, header, aside, menu, ul, ol, li, [role='button'], [role='menuitem'], [contenteditable='true']"
    )
  ) {
    return false;
  }

  const computed = window.getComputedStyle(element);
  if (["flex", "inline-flex", "grid", "inline-grid"].includes(computed.display)) {
    return false;
  }

  const text = normalizeText(element.innerText ?? "");
  return text.length >= MIN_TEXT_LENGTH;
}

function sendSelectionUpdate(): void {
  const payload = Array.from(selectedItems.values());
  chrome.runtime.sendMessage({ type: "SELECTIONS_UPDATED", payload }).catch(() => {
    // Side panel not opened or no listener, safely ignore.
  });
}

function getSelectionTextForHost(host: HTMLElement): string {
  return isDoubaoPage()
    ? normalizeText(host.innerText ?? host.textContent ?? "")
    : normalizeText(host.innerText ?? "");
}

function applyCheckboxSelection(checkbox: HTMLInputElement, checked: boolean): void {
  const id = checkbox.getAttribute(ID_ATTR);
  if (!id) return;
  const host = checkbox.closest<HTMLElement>(`[${HOST_ATTR}="true"]`);
  if (!host) return;
  const text = getSelectionTextForHost(host);
  if (checked) {
    selectedItems.set(id, { id, text, sourceTag: host.tagName.toLowerCase() });
    host.classList.add(HIGHLIGHT_CLASS);
  } else {
    selectedItems.delete(id);
    host.classList.remove(HIGHLIGHT_CLASS);
  }
}

function clearAllSelectionsWithoutNotify(): void {
  for (const checkbox of checkboxById.values()) {
    checkbox.checked = false;
    applyCheckboxSelection(checkbox, false);
  }
}

/** 上旧下新：按视口纵向位置自上而下排序（含锚点及更「新」一侧）。 */
function getSelectableHostsInChatOrder(): HTMLElement[] {
  const hosts = Array.from(document.querySelectorAll<HTMLElement>(`[${HOST_ATTR}="true"]`)).filter((el) =>
    Boolean(el.querySelector<HTMLInputElement>(`[${CONTROL_ATTR}="checkbox"]`))
  );
  return hosts.sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const dy = ra.top - rb.top;
    if (Math.abs(dy) < 0.5) return ra.left - rb.left;
    return dy;
  });
}

function selectAllFromHereInDoubao(anchorHost: HTMLElement): void {
  clearAllSelectionsWithoutNotify();
  const hosts = getSelectableHostsInChatOrder();
  const anchorIdx = hosts.indexOf(anchorHost);
  if (anchorIdx < 0) {
    debugLog("selectAllFromHere:anchor-not-found", { tag: anchorHost.tagName });
    sendSelectionUpdate();
    return;
  }
  for (const host of hosts.slice(anchorIdx)) {
    const checkbox = host.querySelector<HTMLInputElement>(`[${CONTROL_ATTR}="checkbox"]`);
    if (!checkbox) continue;
    checkbox.checked = true;
    applyCheckboxSelection(checkbox, true);
  }
  sendSelectionUpdate();
}

function createCheckboxForChunk(element: HTMLElement, text: string): boolean {
  const id = createStableId(text, element);
  if (checkboxById.has(id)) return false;
  if (hasNearbyCheckbox(element)) return false;
  if (isDoubaoPage() && !isDoubaoUserMessageHost(element)) return false;

  const wrapper = document.createElement("span");
  wrapper.setAttribute(CONTROL_ATTR, "wrapper");
  wrapper.setAttribute(ID_ATTR, id);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.setAttribute(CONTROL_ATTR, "checkbox");
  checkbox.setAttribute(ID_ATTR, id);
  checkbox.title = contentScriptUi.checkboxTitle;

  checkbox.addEventListener("change", () => {
    applyCheckboxSelection(checkbox, checkbox.checked);
    sendSelectionUpdate();
  });

  element.addEventListener("mouseenter", () => {
    if (!checkbox.checked) element.classList.add(HIGHLIGHT_CLASS);
  });
  element.addEventListener("mouseleave", () => {
    if (!checkbox.checked) element.classList.remove(HIGHLIGHT_CLASS);
  });

  wrapper.appendChild(checkbox);
  if (isDoubaoPage()) {
    const bulkBtn = document.createElement("button");
    bulkBtn.type = "button";
    bulkBtn.setAttribute(BULK_INLINE_ATTR, "1");
    bulkBtn.setAttribute("aria-label", contentScriptUi.bulkAriaLabel);
    bulkBtn.title = contentScriptUi.bulkTitle;
    const spanShort = document.createElement("span");
    spanShort.className = "ai-batch-bulk-short";
    spanShort.appendChild(createBulkSelectBelowIconSvg());
    const spanLong = document.createElement("span");
    spanLong.className = "ai-batch-bulk-long";
    spanLong.textContent = contentScriptUi.bulkLabelLong;
    bulkBtn.appendChild(spanShort);
    bulkBtn.appendChild(spanLong);
    bulkBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const host = bulkBtn.closest<HTMLElement>(`[${HOST_ATTR}="true"]`);
      if (!host) return;
      selectAllFromHereInDoubao(host);
    });
    wrapper.appendChild(bulkBtn);
  }
  element.setAttribute(HOST_ATTR, "true");
  element.appendChild(wrapper);

  checkboxById.set(id, checkbox);
  return true;
}

function hasNearbyCheckbox(element: HTMLElement): boolean {
  const targetRect = element.getBoundingClientRect();
  const wrappers = Array.from(document.querySelectorAll<HTMLElement>(`[${CONTROL_ATTR}="wrapper"]`));

  return wrappers.some((wrapper) => {
    const rect = wrapper.getBoundingClientRect();
    const verticallyClose =
      Math.abs(rect.top - targetRect.top) < MESSAGE_DEDUPE_VERTICAL_PX ||
      (rect.top >= targetRect.top - 4 && rect.top <= targetRect.bottom + 4);
    const horizontallyClose =
      Math.abs(rect.left - targetRect.left) < MESSAGE_DEDUPE_HORIZONTAL_PX ||
      (rect.left >= targetRect.left - 40 && rect.left <= targetRect.right + 4);
    return verticallyClose && horizontallyClose;
  });
}

function removeInjectedWrapper(wrapper: HTMLElement): void {
  const id = wrapper.getAttribute(ID_ATTR);
  if (id) {
    selectedItems.delete(id);
    checkboxById.delete(id);
  }
  wrapper.remove();
}

function dedupeDoubaoCheckboxes(): void {
  const legacyNodes = Array.from(document.querySelectorAll<HTMLElement>(LEGACY_TAMPERMONKEY_CHECKBOX_SELECTOR));
  legacyNodes.forEach((node) => node.remove());
  if (legacyNodes.length > 0) {
    debugLog("dedupeDoubaoCheckboxes:legacy", { removedCount: legacyNodes.length });
  }

  const messageRoots = Array.from(document.querySelectorAll<HTMLElement>(DOUBAO_MESSAGE_ROOT_SELECTOR));
  let removedCount = 0;

  for (const root of messageRoots) {
    const wrappers = Array.from(root.querySelectorAll<HTMLElement>(`[${CONTROL_ATTR}="wrapper"]`));
    if (wrappers.length <= 1) continue;

    const primaryWrapper =
      wrappers.find((wrapper) => wrapper.parentElement === root) ??
      wrappers.find((wrapper) => wrapper.parentElement?.hasAttribute(HOST_ATTR)) ??
      wrappers[0];

    for (const wrapper of wrappers) {
      if (wrapper === primaryWrapper) continue;
      removeInjectedWrapper(wrapper);
      removedCount += 1;
    }
  }

  const wrappers = Array.from(document.querySelectorAll<HTMLElement>(`[${CONTROL_ATTR}="wrapper"]`));
  const keptWrappers: HTMLElement[] = [];
  for (const wrapper of wrappers) {
    const rect = wrapper.getBoundingClientRect();
    const duplicate = keptWrappers.some((kept) => {
      const keptRect = kept.getBoundingClientRect();
      return (
        Math.abs(rect.top - keptRect.top) < MESSAGE_DEDUPE_VERTICAL_PX &&
        Math.abs(rect.left - keptRect.left) < MESSAGE_DEDUPE_HORIZONTAL_PX
      );
    });

    if (duplicate) {
      removeInjectedWrapper(wrapper);
      removedCount += 1;
    } else {
      keptWrappers.push(wrapper);
    }
  }

  if (removedCount > 0) {
    debugLog("dedupeDoubaoCheckboxes", { removedCount });
    sendSelectionUpdate();
  }
}

function resetInjectedControls(): void {
  document.getElementById(LEGACY_BULK_TOP_BAR_ID)?.remove();

  const wrapperCount = document.querySelectorAll<HTMLElement>(`[${CONTROL_ATTR}="wrapper"]`).length;
  const legacyCount = document.querySelectorAll<HTMLElement>(LEGACY_TAMPERMONKEY_CHECKBOX_SELECTOR).length;

  document.querySelectorAll<HTMLElement>(`[${CONTROL_ATTR}="wrapper"]`).forEach((node) => node.remove());
  document.querySelectorAll<HTMLElement>(LEGACY_TAMPERMONKEY_CHECKBOX_SELECTOR).forEach((node) => node.remove());
  document.querySelectorAll<HTMLElement>(`[${HOST_ATTR}="true"]`).forEach((node) => {
    node.removeAttribute(HOST_ATTR);
    node.classList.remove(HIGHLIGHT_CLASS);
  });
  document.querySelectorAll<HTMLElement>(`[${NODE_ATTR}]`).forEach((node) => {
    node.removeAttribute(NODE_ATTR);
  });

  selectedItems.clear();
  checkboxById.clear();
  trackedElements.clear();
  nodeIdByElement = new WeakMap<HTMLElement, string>();
  nodeIdSeed = 0;

  debugLog("resetInjectedControls", { removedWrappers: wrapperCount, removedLegacy: legacyCount });
}

function scanPageAndInject(): void {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(SELECTABLE_SELECTOR));

  for (const node of nodes) {
    if (!isValidCandidate(node)) continue;

    const chunks = splitToChunks(node.innerText ?? "");
    if (chunks.length === 0) continue;

    if (createCheckboxForChunk(node, chunks[0])) {
      trackedElements.add(node);
    }
  }
}

function isDoubaoPage(): boolean {
  return DOUBAO_HOST_REGEX.test(location.hostname);
}

/** 暂不考虑多角色：仅用户侧消息打勾。receive_message 视为 AI；send_message / 用户气泡 class 视为用户。 */
function isDoubaoUserMessageHost(host: HTMLElement): boolean {
  if (host.closest('[data-testid="receive_message"]')) {
    if (host.closest('[data-testid="send_message"]')) return true;
    return false;
  }
  if (host.closest('[data-testid="send_message"]')) return true;
  if (host.matches(DOUBAO_USER_BUBBLE_SELECTOR)) return true;
  if (host.querySelector(DOUBAO_USER_BUBBLE_SELECTOR)) return true;
  return false;
}

function getNormalizedInnerText(element: HTMLElement): string {
  return getSelectionTextForHost(element);
}

function isBlockedDoubaoArea(element: HTMLElement): boolean {
  return Boolean(element.closest("aside, nav, header, [role='navigation'], [contenteditable='true']"));
}

function findDoubaoInjectionHost(candidate: HTMLElement): HTMLElement | null {
  const knownRoot = candidate.closest<HTMLElement>(DOUBAO_MESSAGE_ROOT_SELECTOR);
  if (knownRoot) return knownRoot;

  const candidateText = getNormalizedInnerText(candidate);
  if (candidateText.length < MIN_TEXT_LENGTH) return null;

  let host = candidate;
  let current: HTMLElement | null = candidate;

  for (let depth = 0; depth < 5 && current !== null; depth += 1) {
    const parent: HTMLElement | null = current.parentElement;
    if (!parent) break;
    if (parent === document.body || isBlockedDoubaoArea(parent)) break;

    const parentText = getNormalizedInnerText(parent);
    if (!parentText.includes(candidateText)) break;

    const tooBroad =
      parentText.length >
      Math.max(candidateText.length * PARENT_TEXT_EXPANSION_FACTOR, candidateText.length + PARENT_TEXT_EXPANSION_ABS);
    const rect = parent.getBoundingClientRect();
    const tooWide = rect.width > window.innerWidth * HOST_WIDTH_RATIO_LIMIT;
    if (tooBroad || tooWide) break;

    host = parent;
    current = parent;
  }

  return host;
}

function areSameDoubaoMessage(a: HTMLElement, aText: string, b: HTMLElement, bText: string): boolean {
  if (a === b || a.contains(b) || b.contains(a)) return true;
  if (!aText.includes(bText) && !bText.includes(aText)) return false;

  const aRect = a.getBoundingClientRect();
  const bRect = b.getBoundingClientRect();
  const verticalOverlap = Math.min(aRect.bottom, bRect.bottom) - Math.max(aRect.top, bRect.top);
  return verticalOverlap > 0;
}

function preferDoubaoHost(
  current: { host: HTMLElement; text: string },
  next: { host: HTMLElement; text: string }
): { host: HTMLElement; text: string } {
  if (next.host.contains(current.host)) return next;
  if (current.host.contains(next.host)) return current;
  return next.text.length > current.text.length ? next : current;
}

function collectDoubaoHosts(candidates: HTMLElement[]): Array<{ host: HTMLElement; text: string }> {
  const mergedHosts: Array<{ host: HTMLElement; text: string }> = [];

  for (const candidate of candidates) {
    const host = findDoubaoInjectionHost(candidate);
    if (!host) continue;
    if (host.querySelector(`[${CONTROL_ATTR}="checkbox"]`)) continue;
    if (trackedElements.has(host)) continue;
    if (host.closest(`[${CONTROL_ATTR}]`)) continue;
    if (isBlockedDoubaoArea(host)) continue;

    const text = getNormalizedInnerText(host);
    if (text.length < DOUBAO_MIN_TEXT_LENGTH) continue;

    const duplicateIndex = mergedHosts.findIndex((item) =>
      areSameDoubaoMessage(item.host, item.text, host, text)
    );
    if (duplicateIndex >= 0) {
      mergedHosts[duplicateIndex] = preferDoubaoHost(mergedHosts[duplicateIndex], { host, text });
      continue;
    }
    mergedHosts.push({ host, text });
  }

  return mergedHosts;
}

function collectDoubaoClassBasedHosts(): Array<{ host: HTMLElement; text: string }> {
  const hosts: Array<{ host: HTMLElement; text: string }> = [];
  const seen = new Set<HTMLElement>();

  const userBubbles = Array.from(document.querySelectorAll<HTMLElement>(DOUBAO_USER_BUBBLE_SELECTOR));
  for (const bubble of userBubbles) {
    const text = getNormalizedInnerText(bubble);
    if (text.length < DOUBAO_MIN_TEXT_LENGTH) continue;
    if (seen.has(bubble)) continue;
    seen.add(bubble);
    hosts.push({ host: bubble, text });
  }

  return hosts;
}

function scanDoubaoAndInject(): void {
  dedupeDoubaoCheckboxes();

  const classBasedHosts = collectDoubaoClassBasedHosts();
  if (classBasedHosts.length > 0) {
    let injectedFromClasses = 0;
    for (const { host, text } of classBasedHosts) {
      if (trackedElements.has(host)) continue;
      if (host.querySelector(`[${CONTROL_ATTR}="checkbox"]`)) continue;
      if (!createCheckboxForChunk(host, text)) continue;
      trackedElements.add(host);
      injectedFromClasses += 1;
    }

    debugLog("scanDoubaoAndInject:class-path", {
      classBasedHosts: classBasedHosts.length,
      injectedFromClasses,
      trackedElements: trackedElements.size
    });
    if (injectedFromClasses > 0) {
      emptyDoubaoScanStreak = 0;
      return;
    }
  }

  const contentNodes = Array.from(document.querySelectorAll<HTMLElement>(DOUBAO_CONTENT_SELECTOR));
  const debugEnabled = isDebugEnabled();
  const altContentNodes = debugEnabled
    ? Array.from(document.querySelectorAll<HTMLElement>(DOUBAO_ALT_CONTENT_SELECTOR))
    : [];
  const mergedContentNodes =
    contentNodes.length > 0 ? contentNodes : debugEnabled ? altContentNodes : [];
  debugLog("scanDoubaoAndInject:start", {
    contentNodes: contentNodes.length,
    altContentNodes: altContentNodes.length,
    altPathEnabled: debugEnabled
  });

  if (mergedContentNodes.length > 0) {
    const mergedHosts = collectDoubaoHosts(mergedContentNodes);
    let injectedFromContent = 0;

    for (const { host, text } of mergedHosts) {
      if (!createCheckboxForChunk(host, text)) continue;
      trackedElements.add(host);
      injectedFromContent += 1;
    }
    emptyDoubaoScanStreak = 0;
    debugLog("scanDoubaoAndInject:content-path", {
      injectedFromContent,
      trackedElements: trackedElements.size
    });
    if (injectedFromContent > 0) {
      emptyDoubaoScanStreak = 0;
      return;
    }
  }

  const unionWrappers = Array.from(document.querySelectorAll<HTMLElement>(DOUBAO_UNION_SELECTOR));
  const wrappers =
    unionWrappers.length > 0
      ? unionWrappers
      : Array.from(document.querySelectorAll<HTMLElement>(DOUBAO_FALLBACK_SELECTOR)).filter(
          (wrapper) => !wrapper.closest(DOUBAO_UNION_SELECTOR)
        );

  let injectedCount = 0;
  for (const wrapper of wrappers) {
    if (wrapper.querySelector(`[${CONTROL_ATTR}="checkbox"]`)) {
      continue;
    }

    const contentElement = wrapper.querySelector<HTMLElement>(DOUBAO_CONTENT_SELECTOR);
    const host = contentElement ?? wrapper;
    if (!host || trackedElements.has(host)) continue;
    if (host.closest(`[${CONTROL_ATTR}]`)) continue;

    const text = normalizeText(host.innerText ?? "");
    if (text.length < DOUBAO_MIN_TEXT_LENGTH) continue;

    if (!createCheckboxForChunk(host, text)) continue;
    trackedElements.add(host);
    injectedCount += 1;
  }

  debugLog("scanDoubaoAndInject:fallback-path", {
    wrappers: wrappers.length,
    injectedCount,
    trackedElements: trackedElements.size
  });

  if (injectedCount === 0) {
    emptyDoubaoScanStreak += 1;
    if (emptyDoubaoScanStreak <= 8) {
      scheduleScan(250);
    } else {
      debugLog("scanDoubaoAndInject:stop-rescan", {
        reason: "too-many-empty-scans",
        emptyDoubaoScanStreak
      });
    }
  } else {
    emptyDoubaoScanStreak = 0;
  }
}

function runScan(): void {
  debugLog("runScan", {
    isDoubao: isDoubaoPage(),
    selectedItems: selectedItems.size,
    trackedElements: trackedElements.size
  });
  if (isDoubaoPage()) {
    scanDoubaoAndInject();
    return;
  }
  scanPageAndInject();
}

function scheduleScan(delay = 80): void {
  if (scanTimer) window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => {
    const runtimeWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    };
    if (typeof runtimeWindow.requestIdleCallback === "function") {
      runtimeWindow.requestIdleCallback(() => runScan(), { timeout: 500 });
      return;
    }
    window.setTimeout(() => runScan(), 0);
  }, delay);
}

chrome.runtime.onMessage.addListener((message: { type: string; payload?: unknown }, _, sendResponse) => {
  if (message.type === "REQUEST_SELECTIONS") {
    sendResponse({ selectedTexts: Array.from(selectedItems.values()) });
    return true;
  }

  if (message.type === "CLEAR_ALL_SELECTIONS") {
    clearAllSelectionsWithoutNotify();
    sendSelectionUpdate();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "REMOVE_SELECTION") {
    const id = (message.payload as { id?: string } | undefined)?.id;
    if (!id) return false;

    selectedItems.delete(id);
    const checkbox = checkboxById.get(id);
    if (checkbox) {
      checkbox.checked = false;
      const host =
        checkbox.closest<HTMLElement>(`[${HOST_ATTR}="true"]`) ??
        checkbox.closest<HTMLElement>("p, div, span");
      host?.classList.remove(HIGHLIGHT_CLASS);
    }
    sendSelectionUpdate();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

injectStyles();
if (isDoubaoPage()) {
  resetInjectedControls();
}
debugLog("content-script-init", {
  href: location.href,
  debug: isDebugEnabled()
});
runScan();
window.setTimeout(() => runScan(), 600);
window.setTimeout(() => runScan(), 1800);

const observer = new MutationObserver(() => {
  scheduleScan();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});
