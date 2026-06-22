"use client";

import { useState } from "react";

// Список «поле: значения» с маркерами и сворачиванием длинных перечней.
// Используется и в карточке (мобильный), и в колонках таблицы (десктоп).
export function CollapsibleList({
  items,
  limit = 3,
}: {
  items: { id: string; title: string }[];
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const shown = expanded ? items : items.slice(0, limit);
  const hiddenCount = items.length - limit;

  return (
    <div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {shown.map((it) => (
          <li key={it.id} className="flex gap-2 text-sm text-gray-700">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-gray-300" />
            <span className="min-w-0">{it.title}</span>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-blue-600 hover:underline"
        >
          {expanded ? "Свернуть" : `Показать ещё ${hiddenCount}`}
        </button>
      )}
    </div>
  );
}
