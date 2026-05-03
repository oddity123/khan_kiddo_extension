import { useCallback, useEffect, useState } from "react";
import { ResultsPanel } from "../components/ResultsPanel";
import { SelectedItemsPanel } from "../components/SelectedItemsPanel";
import { useAnalyzerStore } from "../store/useAnalyzerStore";
import { getActiveTabId, sendMessageToTab } from "../utils/chrome";
import { sidePanel } from "../utils/branding";
import { resolveKhanApiOrigin } from "../utils/resolveKhanApiOrigin";
import type { AnalysisResult, SelectedTextItem } from "../utils/types";

interface SelectionResponse {
  selectedTexts: SelectedTextItem[];
}

interface AnalyzeResponse {
  results?: AnalysisResult[];
  error?: string;
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10.5V20h14v-9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

export default function App() {
  const [apiOrigin, setApiOrigin] = useState<string | null>(null);

  const {
    selectedItems,
    results,
    loading,
    setSelectedItems,
    removeSelectedItem,
    clearSelectedItems,
    setResults,
    setLoading,
    clearResults
  } = useAnalyzerStore();

  const refreshApiOrigin = useCallback(() => {
    void resolveKhanApiOrigin().then(setApiOrigin);
  }, []);

  useEffect(() => {
    refreshApiOrigin();
    const onStorage = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local" || !("khanApiOrigin" in changes)) return;
      refreshApiOrigin();
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, [refreshApiOrigin]);

  const handleOpenHome = useCallback(() => {
    if (!apiOrigin) return;
    const url = apiOrigin.endsWith("/") ? apiOrigin : `${apiOrigin}/`;
    void chrome.tabs.create({ url });
  }, [apiOrigin]);

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

  const handleClearAllSelections = useCallback(async () => {
    clearSelectedItems();
    const tabId = await getActiveTabId();
    if (!tabId) return;
    await sendMessageToTab(tabId, { type: "CLEAR_ALL_SELECTIONS" });
  }, [clearSelectedItems]);

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
          original: sidePanel.analyzeFailedOriginal,
          suggestion: response?.error ?? sidePanel.analyzeFailedFallback,
          type: "expression"
        }
      ]);
    }

    setLoading(false);
  }, [clearResults, loading, selectedItems, setLoading, setResults]);

  const hasAnalysisResults = results.length > 0 && !loading;

  return (
    <main className="flex h-screen max-h-screen flex-col overflow-hidden bg-gradient-to-b from-panel-50 to-white p-4 text-slate-900">
      <header className="shrink-0 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-soft">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-semibold leading-snug text-slate-800">{sidePanel.headerTitle}</h1>
            <button
              type="button"
              onClick={handleOpenHome}
              disabled={!apiOrigin}
              aria-label={sidePanel.goHomeLink}
              className="group inline-flex shrink-0 items-center rounded-lg border border-transparent px-1.5 py-1.5 text-blue-600 transition-all duration-150 ease-out hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-slate-300 disabled:opacity-45 disabled:shadow-none"
            >
              <HomeIcon className="h-4 w-4" />
              <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium opacity-0 transition-all duration-150 group-hover:ml-1 group-hover:max-w-20 group-hover:opacity-100">
                {sidePanel.goHomeLink}
              </span>
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{sidePanel.headerTagline}</p>
        </div>
      </header>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
        <SelectedItemsPanel
          items={selectedItems}
          compact={hasAnalysisResults}
          onRemove={handleRemoveSelection}
          onClearAll={handleClearAllSelections}
        />

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={selectedItems.length === 0 || loading}
          className="shrink-0 w-full rounded-xl border border-slate-200 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-300 disabled:text-white"
        >
          {loading ? sidePanel.analyzing : sidePanel.analyzeButton}
        </button>

        <div className="flex min-h-0 flex-1 flex-col">
          <ResultsPanel results={results} loading={loading} />
        </div>
      </div>
    </main>
  );
}
