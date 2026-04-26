import type { SelectedTextItem } from "../utils/types";

interface SelectedItemsPanelProps {
  items: SelectedTextItem[];
  onRemove: (id: string) => void;
}

export function SelectedItemsPanel({ items, onRemove }: SelectedItemsPanelProps) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Selected Items</h2>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          No selected text yet. Go to any page and tick checkboxes next to text blocks.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-100 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/50"
            >
              <div className="mb-2 text-xs leading-relaxed text-slate-700">{item.text}</div>
              <button
                onClick={() => onRemove(item.id)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 transition hover:border-red-200 hover:text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
