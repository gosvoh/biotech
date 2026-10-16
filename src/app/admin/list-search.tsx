"use client";

import { Button, Empty, Input, Typography } from "antd";
import { useId } from "react";

export function ListSearch({ value, onChange, foundCount, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  foundCount: number;
  placeholder: string;
}) {
  const id = useId();
  return <div className="my-3 flex min-w-0 flex-col gap-2 sm:flex-1">
    <label htmlFor={id}>{placeholder}</label>
    <div className="flex min-w-0 gap-2">
      <Input id={id} aria-label={placeholder} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
      <Button aria-label="Очистить поиск" disabled={!value} onClick={() => onChange("")}>Очистить</Button>
    </div>
    <Typography.Text type="secondary" role="status" aria-live="polite">Найдено: {foundCount}</Typography.Text>
    {foundCount === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<><div>Ничего не найдено</div><div>Измените запрос или очистите поиск.</div></>} />}
  </div>;
}
