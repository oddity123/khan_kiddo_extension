import type { SelectedTextItem } from "../utils/types";

interface SelectedItemsPanelProps {
  items: SelectedTextItem[];
  onRemove: (id: string) => void;
}

export function SelectedItemsPanel({ items, onRemove }: SelectedItemsPanelProps) {
  const listScrollClass =
    items.length > 0 ? "max-h-[min(52vh,380px)] overflow-y-auto overflow-x-hidden pr-0.5" : "";

  return (
    <section className="shrink-0 rounded-2xl bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">已选片段</h2>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          {items.length}
        </span>
      </div>

      <div className={listScrollClass}>
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            暂无选中内容。请在对话里勾选要分析的复选框。
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex h-24 flex-shrink-0 flex-col rounded-xl border border-slate-100 bg-white p-2.5 transition hover:border-blue-200 hover:bg-blue-50/50"
              >
                <p className="min-h-0 flex-1 overflow-hidden break-words text-xs leading-snug text-slate-700 line-clamp-2">
                  {item.text}
                </p>
                <div className="mt-1 flex shrink-0 justify-end">
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-500 transition hover:border-red-200 hover:text-red-600"
                  >
                    移除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
