import { resultsPanel } from "../utils/branding";
import type { AnalysisResult } from "../utils/types";

interface ResultsPanelProps {
  results: AnalysisResult[];
  loading: boolean;
}

function analysisTypeLabel(type: AnalysisResult["type"]): string {
  return type === "grammar" ? "语法" : "表达";
}

export function ResultsPanel({ results, loading }: ResultsPanelProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-soft">
      <h2 className="mb-3 shrink-0 text-sm font-semibold text-slate-800">{resultsPanel.sectionTitle}</h2>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
        {loading ? (
          <div className="space-y-2">
            {[...Array.from({ length: 3 })].map((_, idx) => (
              <div key={idx} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            {resultsPanel.emptyHint}
          </p>
        ) : (
          <ul className="space-y-2">
            {results.map((result, idx) => (
              <li key={`${result.original}-${idx}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium tracking-wide text-slate-500">原文</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      result.type === "grammar" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"
                    }`}
                  >
                    {analysisTypeLabel(result.type)}
                  </span>
                </div>
                <p className="mb-2 text-xs leading-relaxed text-slate-700">{result.original}</p>
                <div className="text-[11px] font-semibold text-slate-500">建议</div>
                <p className="text-xs leading-relaxed text-slate-700">{result.suggestion}</p>
                {result.errors && result.errors.length > 0 ? (
                  <div className="mt-2 border-t border-slate-200 pt-2">
                    <div className="mb-1 text-[11px] font-semibold text-slate-500">错误点</div>
                    <ul className="space-y-1.5">
                      {result.errors.map((err, errIdx) => (
                        <li
                          key={`${result.original}-err-${errIdx}`}
                          className="rounded-lg bg-white/80 px-2 py-1.5 text-[11px] leading-snug text-slate-700"
                        >
                          <span className="font-medium text-slate-800">{err.type}</span>
                          {err.errorLevel ? (
                            <span className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-500">
                              {err.errorLevel}
                            </span>
                          ) : null}
                          <p className="mt-0.5 text-slate-600">{err.point}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
