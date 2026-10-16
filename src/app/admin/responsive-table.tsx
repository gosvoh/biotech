"use client";

import { Grid, Pagination, Table } from "antd";
import type { TableProps } from "antd";
import { useEffect, useRef, useState } from "react";

const { useBreakpoint } = Grid;

type ResponsiveTableProps<T> = TableProps<T> & {
  renderCard: (record: T) => React.ReactNode;
  mobilePageSize?: number;
  resetKey?: string;
};

export function ResponsiveTable<T extends object>({
  renderCard,
  mobilePageSize = 12,
  resetKey,
  ...tableProps
}: ResponsiveTableProps<T>) {
  const screens = useBreakpoint();
  // До маунта (SSR и первый клиентский рендер) screens.md === undefined →
  // isMobile === false → рендерим Table. Сервер и клиент совпадают, поэтому
  // hydration mismatch не возникает; на мобильном переключение на карточки
  // происходит уже после маунта (обычный ре-рендер, не ошибка).
  const isMobile = screens.md === false;
  const pagination = tableProps.pagination === false ? false : tableProps.pagination ?? {};
  const [paging, setPaging] = useState({
    key: resetKey,
    page: pagination ? pagination.defaultCurrent ?? 1 : 1,
    size: pagination ? pagination.defaultPageSize ?? 10 : 10,
  });
  if (paging.key !== resetKey) {
    setPaging({ ...paging, key: resetKey, page: 1 });
  }
  const data = tableProps.dataSource ?? [];
  const size = isMobile ? mobilePageSize : pagination ? pagination.pageSize ?? paging.size : data.length || 1;
  const count = pagination ? pagination.total ?? data.length : data.length;
  const requestedPage = paging.key !== resetKey ? 1 : pagination && pagination.current !== undefined ? pagination.current : paging.page;
  const page = Math.max(1, Math.min(requestedPage, Math.ceil(count / size) || 1));
  const previousResetKey = useRef(resetKey);
  const controlledCurrent = pagination ? pagination.current : undefined;
  const onPaginationChange = pagination ? pagination.onChange : undefined;
  useEffect(() => {
    const targetPage = previousResetKey.current === resetKey ? page : 1;
    previousResetKey.current = resetKey;
    // Controlled current belongs to the caller; ask it to reset/clamp without
    // inventing a Table onChange event that would lose its filters or sorter.
    if (controlledCurrent !== undefined && controlledCurrent !== targetPage) {
      onPaginationChange?.(targetPage, size);
    }
  }, [resetKey, controlledCurrent, onPaginationChange, size, page]);
  // Store the bounded page so adding a record later cannot resurrect an empty page.
  if (paging.key === resetKey && paging.page !== page && !(pagination && pagination.current !== undefined)) {
    setPaging({ ...paging, page });
  }

  if (!isMobile) {
    return <Table<T> {...tableProps}
      pagination={pagination === false ? false : { ...pagination, current: page }}
      onChange={(next, filters, sorter, extra) => {
        setPaging(current => ({ ...current, page: next.current ?? 1, size: next.pageSize ?? current.size }));
        tableProps.onChange?.(next, filters, sorter, extra);
      }}
    />;
  }

  const { rowKey } = tableProps;
  const getKey = (record: T, index: number): React.Key => {
    if (typeof rowKey === "function") return rowKey(record, index);
    if (typeof rowKey === "string")
      return (record as Record<string, React.Key>)[rowKey];
    return index;
  };

  const start = pagination === false ? 0 : (page - 1) * size;
  const pageItems = pagination === false ? data : data.slice(start, start + size);

  return (
    <div className="flex flex-col gap-3">
      {pageItems.map((record, i) => (
        <div key={getKey(record, start + i)}>{renderCard(record)}</div>
      ))}
      {pagination !== false && count > size && (
        <Pagination
          align="center"
          current={page}
          pageSize={size}
          total={count}
          onChange={(current, pageSize) => {
            setPaging(state => ({ ...state, page: current }));
            pagination.onChange?.(current, pageSize);
            tableProps.onChange?.({ ...pagination, current, pageSize }, {}, {}, { action: "paginate", currentDataSource: [...data] });
          }}
          showSizeChanger={false}
        />
      )}
    </div>
  );
}
