# khan_kiddo_extension

KhanKiddo 浏览器扩展：在豆包对话页勾选用户消息，于侧栏批量整理并分析。

## 运行命令

- **开发模式**（监听构建）：`npm --prefix "./extension" run dev`
- **生产构建**：`npm --prefix "./extension" run build`

构建产物在 `extension/dist/`。在 Chrome 中加载「已解压的扩展程序」并指向该目录；修改代码后执行构建并刷新扩展。

---

## 豆包页消息 DOM 与路径维护

豆包改版后，若复选框不出现或选中范围不对，多半是 **DOM 选择器与页面不一致**。相关逻辑已集中到配置文件，便于单独修改。

### 配置文件位置

| 文件 | 作用 |
|------|------|
| `extension/src/content/doubao-dom-config.ts` | 豆包 **hostname**、**`data-testid`** 常量、**`DOUBAO_DOM`** 下所有用于 `querySelector` / `closest` 的选择器字符串、**`DOUBAO_MIN_TEXT_LENGTH`** 等。 |

`extension/src/content/index.ts` 仅引用上述配置；**内容脚本不要** `import` 会打成独立 chunk 的共享模块（否则 Chrome 注入非 module 会报 `Cannot use import statement outside a module`）。品牌文案在 `extension/src/utils/branding.ts`，侧栏/后台可用；页面脚本里的展示文案用 `content/index.ts` 内与 branding 同步的本地常量。

### 扩展内「消息查找」顺序（`scanDoubaoAndInject`）

在豆包页按下面顺序尝试，**先成功注入的路径会提前结束**（后面的不再跑）：

1. **Class 路径**：`collectDoubaoClassBasedHosts()` — 用 **`DOUBAO_DOM.userBubble`** 匹配用户气泡，仅对用户消息注入。
2. **`message_text_content` 路径**：用 **`DOUBAO_DOM.messageTextContent`** 找候选，经 **`collectDoubaoHosts` → `findDoubaoInjectionHost`**，用 **`DOUBAO_DOM.messageRootKnown`** 做 `closest` 定消息根。若开启调试 `localStorage.__AI_BATCH_DEBUG__ = "1"`，在无主路径命中时会启用 **`DOUBAO_DOM.altContentRescue`**（易误匹配，默认关闭）。
3. **Wrapper 回退路径**：优先 **`DOUBAO_DOM.unionMessage`**；否则 **`DOUBAO_DOM.sendOrReceiveMessage`**（并排除已在 union 内的节点）；在每个 wrapper 内查找 **`messageTextContent`** 作为宿主，没有则用 wrapper 本身。

**用户 / AI 判定**（`isDoubaoUserMessageHost`）：依赖 **`DOUBAO_SEND_MESSAGE_ROOT` / `DOUBAO_RECEIVE_MESSAGE_ROOT`** 与 **`DOUBAO_DOM.userBubble`**；当前策略是**只在用户侧消息**旁显示复选框与「向下全选」。

### 控制台探针（路径失效时自查）

当扩展行为异常、需要在**真实豆包页面**上看各选择器命中情况时：

1. 打开豆包对话页，打开 DevTools → **Console**。
2. 打开仓库文件 **`extension/scripts/doubao-dom-probe.console.js`**，**全选复制**，粘贴到控制台并回车。
3. 查看输出：各选择器的 **命中数量**；非零时会附带 **首个匹配节点** 的 `tag` / `class` / `data-testid` / 文本预览；另有 **`[data-testid*='message']`** 辅助观察改版后的 testid 规律。

**重要**：探针内的 `CFG` 与 **`doubao-dom-config.ts` 是人工双份**。修改 `doubao-dom-config.ts` 后，请 **同步更新** `doubao-dom-probe.console.js` 中对应字段，避免以后控制台调试与扩展实际行为不一致。
