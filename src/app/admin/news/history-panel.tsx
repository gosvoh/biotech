"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Card, Tag } from "antd";
import { useRouter } from "next/navigation";
import type { VkHistoryState } from "@/lib/vk-import/types";
import { VK_FIRST_DAY, VK_TIME_ZONE } from "@/lib/vk-import/policy";
import { queueVkNewsHistory, continueVkNewsHistory } from "./history-actions";
import VkHistoryDetails from "./history-details";

const states = { queued: "В очереди", running: "Выполняется", waiting: "Ожидает повтора", completed: "Завершён" };
function time(value: string | null) {
  return value ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: VK_TIME_ZONE }).format(new Date(value)) + " МСК" : "Ещё не завершена";
}

export default function VkHistoryPanel({ configured, initialJobs, today, loadError }: { configured: boolean; initialJobs: VkHistoryState[]; today: string; loadError?: string | null }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [from, setFrom] = useState<string>(VK_FIRST_DAY);
  const [to, setTo] = useState(today);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const running = useRef(false);
  const router = useRouter();
  useEffect(() => { setJobs(initialJobs); }, [initialJobs]);

  async function perform(id?: string) {
    if (running.current || !configured) return;
    running.current = true; setPending(id ?? "queue"); setError(null);
    try {
      const result = id ? await continueVkNewsHistory(id) : await queueVkNewsHistory(from, to);
      if (!result.ok) setError(result.error);
      else {
        setJobs((old) => [result.data, ...old.filter((item) => item.id !== result.data.id)]);
        router.refresh();
      }
    } catch { setError("Не удалось выполнить запрос. Сохранённую историю можно продолжить после перезагрузки."); }
    finally { running.current = false; setPending(null); }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void perform(); }
  return <Card className="my-5" title="Импорт истории">
    <p className="text-sm text-gray-600">Выберите период по московскому времени: оба дня включены целиком, начиная с 1 сентября 2026 года. Подходящие посты обрабатываются порциями; это может занять время. История сохраняет ручные исключения и самостоятельную редактуру.</p>
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">С даты<input className="rounded border px-3 py-2" name="from" type="date" min={VK_FIRST_DAY} max={today} required value={from} disabled={pending !== null || !configured} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="flex flex-col gap-1 text-sm">По дату<input className="rounded border px-3 py-2" name="to" type="date" min={from || VK_FIRST_DAY} max={today} required value={to} disabled={pending !== null || !configured} onChange={(event) => setTo(event.target.value)} /></label>
      <Button htmlType="submit" disabled={!configured || pending !== null} loading={pending === "queue"}>Импортировать историю</Button>
    </form>
    <p className="mt-3 text-sm text-gray-600">Выбранный период обрабатывается исполнителем и при закрытой странице. Кнопка «Обработать порцию» запускает следующую часть вручную. Первоначальная история при выключенном расписании приостановлена; выбранная вручную история продолжается. Период и прогресс сохраняются. Обычная проверка новых постов выполняется отдельно.</p>
    {(error || loadError) && <p role="alert" className="mt-3 text-red-700">{error ?? loadError}</p>}
    {jobs.map((job) => <div key={job.id} className="mt-4 rounded border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><span className="font-medium">{job.from} — {job.to}</span> <Tag color={job.state === "completed" ? "success" : job.state === "waiting" ? "warning" : "processing"}>{states[job.state]}</Tag>{job.initial && <Tag>Первоначальная история</Tag>}</div>
        {job.state !== "completed" && <Button disabled={!configured || pending !== null} loading={pending === job.id} onClick={() => void perform(job.id)}>Обработать порцию</Button>}
      </div>
      <p className="mt-2 text-sm">Обработано: {job.processed} · Добавлено: {job.added} · Обновлено: {job.updated} · Скрыто: {job.hidden} · Восстановлено: {job.restored} · Пропущено: {job.skipped} · В очереди: {job.queued} · Ошибок: {job.failed}</p>
      <p className="mt-1 text-sm text-gray-500">Последняя успешная часть: {time(job.lastSuccessAt)}</p>
      {job.error && <p role="alert" className="mt-2 text-sm text-red-700">{job.error}</p>}
      <Button className="mt-3" aria-expanded={expandedJobId === job.id} aria-controls={`history-details-${job.id}`} onClick={() => setExpandedJobId((old) => old === job.id ? null : job.id)}>Подробности</Button>
      {expandedJobId === job.id && <div id={`history-details-${job.id}`}><VkHistoryDetails jobId={job.id} refreshKey={JSON.stringify(job)} /></div>}
    </div>)}
  </Card>;
}
