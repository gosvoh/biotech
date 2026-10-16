"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Pagination, Radio, Skeleton, Tag } from "antd";
import type { VkHistoryDetail, VkHistoryDetailsPage, VkHistoryFilter } from "@/lib/vk-import/types";
import { getVkNewsHistoryDetails } from "./history-actions";

function status(item: VkHistoryDetail) {
  if (item.state === "failed") return "Ошибка";
  if (item.state === "pending") return "В очереди";
  if (item.outcome === "added") return "Добавлено";
  if (item.outcome === "changed") return item.reasonCode === "hidden" ? "Скрыто" : item.reasonCode === "restored" ? "Восстановлено" : "Обновлено";
  if (item.outcome === "skipped") return "Пропущено";
  return "Обработано";
}

export default function VkHistoryDetails(props: { jobId: string; refreshKey: string }) {
  return <Details key={props.jobId} {...props} />;
}

function Details({ jobId, refreshKey }: { jobId: string; refreshKey: string }) {
  const [query, setQuery] = useState<{ filter: VkHistoryFilter; page: number; retry: number }>({ filter: "all", page: 1, retry: 0 });
  const request = `${refreshKey}:${query.filter}:${query.page}:${query.retry}`;
  const [loaded, setLoaded] = useState<{ request: string; data?: VkHistoryDetailsPage; error?: string } | null>(null);
  const reconciledRequest = useRef<string | null>(null);
  useEffect(() => {
    // A server clamp reconciles query and response together; that response
    // already satisfies the normalized request, so do not fetch it twice.
    const reconciled = reconciledRequest.current === request;
    reconciledRequest.current = null;
    if (reconciled) return;
    let cancelled = false;
    void getVkNewsHistoryDetails({ jobId, filter: query.filter, page: query.page }).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        const resolvedRequest = `${refreshKey}:${query.filter}:${result.data.page}:${query.retry}`;
        setLoaded({ request: resolvedRequest, data: result.data });
        if (result.data.page !== query.page) {
          reconciledRequest.current = resolvedRequest;
          setQuery((old) => ({ ...old, page: result.data.page }));
        }
      } else setLoaded({ request, error: result.error });
    }).catch(() => {
      if (!cancelled) setLoaded({ request, error: "Не удалось загрузить подробности истории. Повторите запрос." });
    });
    return () => { cancelled = true; };
  }, [jobId, query.filter, query.page, query.retry, refreshKey, request]);
  const current = loaded?.request === request ? loaded : null;
  const data = current?.data;
  return <div role="region" aria-label="Подробности задания" aria-busy={!current} className="mt-4 border-t pt-4">
    <Radio.Group aria-label="Фильтр подробностей" value={query.filter} onChange={(event) => setQuery({ filter: event.target.value, page: 1, retry: 0 })} options={[
      { label: "Все", value: "all" }, { label: "Пропущено", value: "skipped" }, { label: "Ошибки", value: "failed" },
    ]} />
    {!current && <div className="mt-3" role="status"><span>Загружаем подробности…</span><Skeleton active title={false} paragraph={{ rows: 3 }} /></div>}
    {current?.error && <div className="mt-3"><p role="alert" className="mb-2 text-red-700">{current.error}</p><Button onClick={() => setQuery((old) => ({ ...old, retry: old.retry + 1 }))}>Повторить загрузку</Button></div>}
    {data && <>
      <p className="my-3 text-sm">Найдено записей: {data.total}</p>
      {data.items.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr><th scope="col" className="py-2 pr-4">Пост ВК</th><th scope="col" className="py-2 pr-4">Результат</th><th scope="col" className="py-2">Причина</th></tr></thead>
        <tbody>{data.items.map((item) => <tr key={item.postId} className="border-t align-top">
          <td className="py-3 pr-4">{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">Пост {item.postId}</a> : <span className="break-all">Пост {item.postId}</span>}</td>
          <td className="py-3 pr-4"><Tag color={item.state === "failed" ? "error" : item.state === "pending" ? "processing" : "default"}>{status(item)}</Tag></td>
          <td className="min-w-48 py-3 break-words">{item.reasonText}</td>
        </tr>)}</tbody>
      </table></div> : <p className="my-3 text-sm text-gray-600">{query.filter === "failed" ? "Ошибок в этом задании нет." : query.filter === "skipped" ? "Пропущенных записей в этом задании нет." : "В этом задании пока нет записей. Они появятся после обработки порции истории."}</p>}
      <Pagination className="mt-4" current={data.page} total={data.total} pageSize={data.pageSize} showSizeChanger={false} onChange={(page) => setQuery((old) => ({ ...old, page }))} />
    </>}
  </div>;
}
