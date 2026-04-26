import { create } from "zustand";
import type { AnalysisResult, SelectedTextItem } from "../utils/types";

interface AnalyzerState {
  selectedItems: SelectedTextItem[];
  results: AnalysisResult[];
  loading: boolean;
  setSelectedItems: (items: SelectedTextItem[]) => void;
  removeSelectedItem: (id: string) => void;
  setResults: (results: AnalysisResult[]) => void;
  setLoading: (loading: boolean) => void;
  clearResults: () => void;
}

export const useAnalyzerStore = create<AnalyzerState>((set) => ({
  selectedItems: [],
  results: [],
  loading: false,
  setSelectedItems: (items) => set({ selectedItems: items }),
  removeSelectedItem: (id) =>
    set((state) => ({
      selectedItems: state.selectedItems.filter((item) => item.id !== id)
    })),
  setResults: (results) => set({ results }),
  setLoading: (loading) => set({ loading }),
  clearResults: () => set({ results: [] })
}));
