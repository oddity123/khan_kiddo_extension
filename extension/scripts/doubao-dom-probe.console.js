/**
 * KhanKiddo — 豆包页 DOM 探针（在豆包对话页打开 DevTools → Console，整段粘贴回车）
 *
 * 用途：扩展失效时快速看各选择器命中数量；请与 `src/content/doubao-dom-config.ts` 保持同步。
 */
(function () {
  const CFG = {
    hostRegex: "(^|\\.)doubao\\.com$",
    testIds: {
      sendMessage: "send_message",
      receiveMessage: "receive_message",
      unionMessage: "union_message",
      messageTextContent: "message_text_content"
    },
    selectors: {
      unionMessage: 'div[data-testid="union_message"]',
      sendOrReceiveMessage:
        'div[data-testid="send_message"], div[data-testid="receive_message"]',
      messageTextContent: 'div[data-testid="message_text_content"]',
      altContentRescue:
        '[data-testid*="message"][data-testid*="content"], [data-testid*="content"][data-testid*="text"], [class*="message"][class*="content"]',
      messageRootKnown:
        'div[data-testid="union_message"], div[data-testid="send_message"], div[data-testid="receive_message"], article, [class*="message-item"]',
      userBubble: "div.bg-g-send-msg-bubble-bg.whitespace-pre-wrap.wrap-anywhere",
      legacyTampermonkeyCheckbox: ".gm-message-checkbox-container, input.gm-message-checkbox"
    }
  };

  const hostOk = new RegExp(CFG.hostRegex, "i").test(location.hostname);
  console.log("%c[KhanKiddo DOM 探针]", "font-weight:bold;color:#2563eb", {
    href: location.href,
    hostnameMatch: hostOk
  });
  if (!hostOk) {
    console.warn("当前域名不像豆包页，结果仅供参考。");
  }

  function probe(label, sel) {
    let list;
    try {
      list = document.querySelectorAll(sel);
    } catch (e) {
      console.error(label, "选择器非法", sel, e);
      return;
    }
    const n = list.length;
    const row = { label, count: n, selector: sel };
    if (n === 0) {
      console.log("○", row);
      return;
    }
    const first = list[0];
    const sample = {
      tag: first.tagName,
      className: (first.className && String(first.className).slice(0, 120)) || "",
      testid: first.getAttribute && first.getAttribute("data-testid"),
      textPreview: (first.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80)
    };
    console.log("●", { ...row, sample });
  }

  console.log("%c--- 扩展主用选择器 ---", "color:#64748b");
  Object.entries(CFG.selectors).forEach(([k, sel]) => probe(k, sel));

  console.log("%c--- data-testid 含 message 的节点（辅助发现改版）---", "color:#64748b");
  probe("any data-testid*=message", "[data-testid*='message']");

  console.log("%c--- 完成 ---", "color:#64748b", "若关键项 count 为 0，请对照页面 DOM 更新 doubao-dom-config.ts");
})();
