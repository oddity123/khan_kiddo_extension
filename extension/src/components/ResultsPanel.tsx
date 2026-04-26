import type { AnalysisResult } from "../utils/types";

interface ResultsPanelProps {
  results: AnalysisResult[];
  loading: boolean;
}

export function ResultsPanel({ results, loading }: ResultsPanelProps) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-soft">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">Results</h2>

      {loading ? (
        <div className="space-y-2">
          {[...Array.from({ length: 3 })].map((_, idx) => (
            <div key={idx} className="h-14 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          Analysis output will appear here.
        </p>
      ) : (
        <ul className="space-y-2">
          {results.map((result, idx) => (
            <li key={`${result.original}-${idx}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Original</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    result.type === "grammar" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"
                  }`}
                >
                  {result.type}
                </span>
              </div>
              <p className="mb-2 text-xs leading-relaxed text-slate-700">{result.original}</p>
              <div className="text-[11px] font-semibold text-slate-500">Suggestion</div>
              <p className="text-xs leading-relaxed text-slate-700">{result.suggestion}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
