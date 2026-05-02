import { useCallback, useEffect } from "react";
import { ResultsPanel } from "../components/ResultsPanel";
import { SelectedItemsPanel } from "../components/SelectedItemsPanel";
import { useAnalyzerStore } from "../store/useAnalyzerStore";
import { getActiveTabId, sendMessageToTab } from "../utils/chrome";
import type { AnalysisResult, SelectedTextItem } from "../utils/types";

interface SelectionResponse {
  selectedTexts: SelectedTextItem[];
}

interface AnalyzeResponse {
  results?: AnalysisResult[];
  error?: string;
}

export default function App() {
  const {
    selectedItems,
    results,
    loading,
    setSelectedItems,
    removeSelectedItem,
    setResults,
    setLoading,
    clearResults
  } = useAnalyzerStore();

  const loadSelections = useCallback(async () => {
    const tabId = await getActiveTabId();
    if (!tabId) return;

    const response = await sendMessageToTab<SelectionResponse>(tabId, { type: "REQUEST_SELECTIONS" });
    setSelectedItems(response?.selectedTexts ?? []);
  }, [setSelectedItems]);

  useEffect(() => {
    loadSelections();

    const listener = (message: { type: string; payload?: SelectedTextItem[] }) => {
      if (message.type === "SELECTIONS_UPDATED") {
        setSelectedItems(message.payload ?? []);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [loadSelections, setSelectedItems]);

  const handleRemoveSelection = useCallback(
    async (id: string) => {
      removeSelectedItem(id);
      const tabId = await getActiveTabId();
      if (!tabId) return;
      await sendMessageToTab(tabId, { type: "REMOVE_SELECTION", payload: { id } });
    },
    [removeSelectedItem]
  );

  const handleAnalyze = useCallback(async () => {
    if (selectedItems.length === 0 || loading) return;

    setLoading(true);
    clearResults();

    const response = await chrome.runtime.sendMessage({
      type: "ANALYZE_TEXTS",
      payload: selectedItems.map((item) => item.text)
    } as const) as AnalyzeResponse;

    if (response?.results) {
      setResults(response.results);
    } else {
      setResults([
        {
          original: "批量分析失败",
          suggestion: response?.error ?? "后台服务出现未知错误。",
          type: "expression"
        }
      ]);
    }

    setLoading(false);
  }, [clearResults, loading, selectedItems, setLoading, setResults]);

  return (
    <main className="flex h-screen max-h-screen flex-col overflow-hidden bg-gradient-to-b from-panel-50 to-white p-4 text-slate-900">
      <header className="shrink-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-soft">
        <p className="text-[11px] tracking-wide text-slate-400">对话批量分析</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-800">勾选多条消息后一键分析</h1>
        <p className="mt-2 text-xs text-slate-500">
          请先在页面里勾选消息旁的复选框，再点击下方按钮；已选列表过长时可在区域内滚动查看。
        </p>
      </header>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
        <SelectedItemsPanel items={selectedItems} onRemove={handleRemoveSelection} />

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={selectedItems.length === 0 || loading}
          className="shrink-0 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "分析中…" : "分析已选项"}
        </button>

        <ResultsPanel results={results} loading={loading} />
      </div>
    </main>
  );
}
