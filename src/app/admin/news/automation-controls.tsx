"use client";
import { useEffect, useRef, useState } from "react";
import { Switch } from "antd";
import { useRouter } from "next/navigation";
import type { VkAutomationState } from "@/lib/vk-import/types";
import { setVkNewsAutomation } from "./automation-actions";
const initialStates = { queued: "В очереди", running: "Выполняется", waiting: "Ожидает повтора", completed: "Завершена" };
const time = (value: string | null) => value ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Moscow" }).format(new Date(value)) + " МСК" : "Ещё не выполнялась";

export default function VkAutomationControls({ initialState, configured, source }: { initialState: VkAutomationState; configured: boolean; source: string | null }) {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const router = useRouter();
  useEffect(() => { setState(initialState); }, [initialState]);
  useEffect(() => {
    if ((!state.enabled && !state.running && !state.queued) || pending) return;
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [state.enabled, state.running, state.queued, pending, router]);
  async function toggle(enabled: boolean) {
    if (running.current) return;
    running.current = true; setPending(true); setError(null);
    try {
      const result = await setVkNewsAutomation(enabled, source, state.groupId);
      if (result.ok) { setState(result.data); router.refresh(); }
      else setError(result.error);
    } catch { setError("Не удалось изменить расписание. Обновите страницу и повторите попытку."); }
    finally { running.current = false; setPending(false); }
  }
  return <div className="mt-4 rounded border border-gray-200 p-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="font-medium">Автоматический импорт</p><p className="mt-1 text-gray-500">{!configured ? "ВК не подключён" : state.running ? "Проверка выполняется" : state.enabled ? "Расписание включено" : "Расписание выключено"}</p></div>
      <Switch aria-label="Автоматический импорт" checked={state.enabled} loading={pending} disabled={pending || (!configured && !state.enabled)} onChange={(checked) => void toggle(checked)} />
    </div>
    <p className="mt-3 text-gray-600">Проверяет новые посты каждые 15 минут, изменения и удаления — раз в сутки среди 30 последних записей. Первое включение запускает историю с 1 сентября 2026 года; повторное включение продолжает её прогресс.</p>
    <p className="mt-2 text-gray-600">Отключение останавливает проверки по расписанию и приостанавливает первоначальную историю. Ручная проверка, выбранная история и пересмотр тегов остаются доступны. Исполнитель работает и при закрытой админке.</p>
    {state.manualCheckPending && <p className="mt-2" aria-live="polite">Ручная проверка сохранена в очереди. Исполнитель выполнит её при выключенном расписании.</p>}
    {state.initialState && <p className="mt-2">Первоначальная история: {initialStates[state.initialState.state]}. Обработано: {state.initialState.processed} · Ошибок: {state.initialState.failed}. Подробности — в панели истории.</p>}
    {state.enabled && <div className="mt-2 grid gap-2 sm:grid-cols-2"><p>Следующая проверка новых постов: {time(state.nextNewAt)}</p><p>Следующая проверка изменений: {time(state.nextSyncAt)}</p></div>}
    <p className="mt-2 text-gray-500">Последняя активность исполнителя: {time(state.lastWorkerAt)}</p>
    {(error || state.error) && <p role="alert" className="mt-2 text-red-700">{error ?? state.error}</p>}
  </div>;
}
