import { selectedPanel } from "../utils/branding";
import type { SelectedTextItem } from "../utils/types";

interface SelectedItemsPanelProps {
  items: SelectedTextItem[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

function TrashIcon({ className }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function SelectedItemsPanel({ items, onRemove, onClearAll }: SelectedItemsPanelProps) {
  const listScrollClass =
    items.length > 0 ? "max-h-[min(52vh,380px)] overflow-y-auto overflow-x-hidden pr-0.5" : "";

  return (
    <section className="shrink-0 rounded-2xl bg-white p-4 shadow-soft">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">{selectedPanel.sectionTitle}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            {items.length}
          </span>
          {items.length > 0 ? (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {selectedPanel.clearAll}
            </button>
          ) : null}
        </div>
      </div>

      <div className={listScrollClass}>
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            {selectedPanel.emptyHint}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex h-[4.25rem] flex-shrink-0 gap-1.5 rounded-lg border border-slate-100 bg-white py-1.5 pl-2 pr-1 transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <p className="min-w-0 flex-1 self-center overflow-hidden break-words text-xs leading-snug text-slate-700 line-clamp-2">
                  {item.text}
                </p>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label={selectedPanel.removeAria}
                  title={selectedPanel.removeTitle}
                  className="shrink-0 self-start rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
