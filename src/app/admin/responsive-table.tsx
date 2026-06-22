"use client";

import { Grid, Pagination, Table } from "antd";
import type { TableProps } from "antd";
import { useState } from "react";

const { useBreakpoint } = Grid;

type ResponsiveTableProps<T> = TableProps<T> & {
  renderCard: (record: T) => React.ReactNode;
  mobilePageSize?: number;
};

export function ResponsiveTable<T extends object>({
  renderCard,
  mobilePageSize = 12,
  ...tableProps
}: ResponsiveTableProps<T>) {
  const screens = useBreakpoint();
  // До маунта (SSR и первый клиентский рендер) screens.md === undefined →
  // isMobile === false → рендерим Table. Сервер и клиент совпадают, поэтому
  // hydration mismatch не возникает; на мобильном переключение на карточки
  // происходит уже после маунта (обычный ре-рендер, не ошибка).
  const isMobile = screens.md === false;
  const [page, setPage] = useState(1);

  if (!isMobile) {
    return <Table<T> {...tableProps} />;
  }

  const data = (tableProps.dataSource ?? []) as readonly T[];
  const { rowKey } = tableProps;
  const getKey = (record: T, index: number): React.Key => {
    if (typeof rowKey === "function") return rowKey(record, index);
    if (typeof rowKey === "string")
      return (record as Record<string, React.Key>)[rowKey];
    return index;
  };

  const start = (page - 1) * mobilePageSize;
  const pageItems = data.slice(start, start + mobilePageSize);

  return (
    <div className="flex flex-col gap-3">
      {pageItems.map((record, i) => (
        <div key={getKey(record, start + i)}>{renderCard(record)}</div>
      ))}
      {data.length > mobilePageSize && (
        <Pagination
          align="center"
          current={page}
          pageSize={mobilePageSize}
          total={data.length}
          onChange={setPage}
          showSizeChanger={false}
        />
      )}
    </div>
  );
}
