import type { SelectedTextItem } from "../utils/types";

const SELECTABLE_SELECTOR = "p, div, span";
const MIN_TEXT_LENGTH = 24;
const MAX_TEXT_LENGTH = 480;
const CONTROL_ATTR = "data-ai-batch-control";
const ID_ATTR = "data-ai-batch-id";
const HIGHLIGHT_CLASS = "ai-batch-highlight";
const STYLE_ID = "ai-batch-style";

const selectedItems = new Map<string, SelectedTextItem>();
const checkboxById = new Map<string, HTMLInputElement>();
const trackedElements = new Set<HTMLElement>();

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function splitToChunks(rawText: string): string[] {
  return rawText
    .split(/(?<=[.!?;。！？；])\s+|\n+/)
    .map(normalizeText)
    .filter((chunk) => chunk.length >= MIN_TEXT_LENGTH && chunk.length <= MAX_TEXT_LENGTH);
}

function createStableId(text: string, index: number): string {
  const seed = `${location.hostname}-${index}-${text.slice(0, 60)}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return `chunk-${Math.abs(hash)}`;
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
      display: inline-flex;
      align-items: flex-start;
      gap: 6px;
      width: 100%;
    }
    [${CONTROL_ATTR}="checkbox"] {
      margin-top: 3px;
      accent-color: #3b82f6;
      cursor: pointer;
      flex: 0 0 auto;
    }
  `;
  document.head.appendChild(style);
}

function isValidCandidate(element: HTMLElement): boolean {
  if (trackedElements.has(element)) return false;
  if (element.closest(`[${CONTROL_ATTR}]`)) return false;
  if (element.children.length > 6) return false;
  if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"].includes(element.tagName)) {
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

function createCheckboxForChunk(
  element: HTMLElement,
  text: string,
  chunkIndex: number
): void {
  const id = createStableId(text, chunkIndex);
  if (checkboxById.has(id)) return;

  const wrapper = document.createElement("span");
  wrapper.setAttribute(CONTROL_ATTR, "wrapper");
  wrapper.setAttribute(ID_ATTR, id);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.setAttribute(CONTROL_ATTR, "checkbox");
  checkbox.setAttribute(ID_ATTR, id);
  checkbox.title = "Select for AI batch analysis";

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedItems.set(id, { id, text, sourceTag: element.tagName.toLowerCase() });
      element.classList.add(HIGHLIGHT_CLASS);
    } else {
      selectedItems.delete(id);
      element.classList.remove(HIGHLIGHT_CLASS);
    }
    sendSelectionUpdate();
  });

  element.addEventListener("mouseenter", () => {
    if (!checkbox.checked) element.classList.add(HIGHLIGHT_CLASS);
  });
  element.addEventListener("mouseleave", () => {
    if (!checkbox.checked) element.classList.remove(HIGHLIGHT_CLASS);
  });

  wrapper.appendChild(checkbox);
  element.prepend(wrapper);

  checkboxById.set(id, checkbox);
}

function scanPageAndInject(): void {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(SELECTABLE_SELECTOR));
  let globalChunkIndex = 0;

  for (const node of nodes) {
    if (!isValidCandidate(node)) continue;

    const chunks = splitToChunks(node.innerText ?? "");
    if (chunks.length === 0) continue;

    createCheckboxForChunk(node, chunks[0], globalChunkIndex);
    globalChunkIndex += chunks.length;
    trackedElements.add(node);
  }
}

chrome.runtime.onMessage.addListener((message: { type: string; payload?: unknown }, _, sendResponse) => {
  if (message.type === "REQUEST_SELECTIONS") {
    sendResponse({ selectedTexts: Array.from(selectedItems.values()) });
    return true;
  }

  if (message.type === "REMOVE_SELECTION") {
    const id = (message.payload as { id?: string } | undefined)?.id;
    if (!id) return false;

    selectedItems.delete(id);
    const checkbox = checkboxById.get(id);
    if (checkbox) {
      checkbox.checked = false;
      const host = checkbox.closest("p, div, span");
      host?.classList.remove(HIGHLIGHT_CLASS);
    }
    sendSelectionUpdate();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

injectStyles();
scanPageAndInject();

const observer = new MutationObserver(() => {
  window.requestIdleCallback?.(() => scanPageAndInject());
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
