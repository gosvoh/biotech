"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Tag } from "antd";
import { SyncOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import VkAutomationControls from "./automation-controls";
import type { VkAutomationState, VkImportStatus } from "@/lib/vk-import/types";
import type { VkTagRecheckStatus } from "@/lib/vk-import/recheck";
import { checkVkNews, recheckVkNewsTags } from "./import-actions";

function formatTime(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Moscow" }).format(new Date(value)) + " МСК" : "Ещё не выполнялась";
}

export default function VkImportPanel({ initialStatus, initialTagStatus, initialAutomation }: { initialStatus: VkImportStatus; initialTagStatus?: VkTagRecheckStatus | null; initialAutomation?: VkAutomationState }) {
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const [tagsPending, setTagsPending] = useState(false);
  const [tagStatus, setTagStatus] = useState(initialTagStatus);
  const running = useRef(false);
  const router = useRouter();
  useEffect(() => { setStatus(initialStatus); }, [initialStatus]);
  useEffect(() => { setTagStatus(initialTagStatus); }, [initialTagStatus]);

  async function check() {
    if (running.current || !status.configured) return;
    running.current = true; setPending(true);
    try {
      const result = await checkVkNews();
      if (!result.ok) setStatus((old) => ({ ...old, error: result.error, lastResult: null }));
      else {
        setStatus((old) => ({ ...old, group: result.data.group, lastAttemptAt: result.data.startedAt, lastSuccessAt: result.data.lastSuccessAt, lastResult: result.data, lastSyncAt: result.data.sync?.successful ? result.data.sync.finishedAt : old.lastSyncAt, lastSyncResult: result.data.sync ?? old.lastSyncResult, error: result.data.error }));
        router.refresh();
      }
    } catch {
      setStatus((old) => ({ ...old, error: "Не удалось завершить запрос. Повторите проверку.", lastResult: null }));
    } finally { running.current = false; setPending(false); }
  }

  async function retryTags() {
    if (running.current || !status.configured) return;
    running.current = true; setTagsPending(true);
    try {
      const result = await recheckVkNewsTags();
      if (result.ok) { setTagStatus(result.data); router.refresh(); }
      else setTagStatus((old) => old ? { ...old, error: result.error } : old);
    } catch { setTagStatus((old) => old ? { ...old, error: "Не удалось пересмотреть теги. Запрос сохранён для повтора." } : old); }
    finally { running.current = false; setTagsPending(false); }
  }
  const source = status.group?.screenName ?? status.source;
  const sourcePath = source && /^-?\d+$/.test(source) ? `club${Math.abs(Number(source))}` : source;
  const result = status.lastResult;
  const synced = status.lastSyncResult ?? result?.sync;
  return (
    <Card className="my-5" title="Новости из ВК">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-medium">
            {source ? <a href={`https://vk.ru/${sourcePath}`} target="_blank" rel="noopener noreferrer">{status.group?.name ?? source}</a> : "Источник не настроен"}
            {status.group && <span className="ml-2 text-sm text-gray-500">{source}</span>}
          </div>
          <div className="mt-2">
            <Tag color={!status.configured || status.error ? "error" : status.lastSuccessAt ? "success" : "default"}>
              {!status.configured ? "Требуется настройка" : status.error ? "Проверка требует внимания" : status.lastSuccessAt ? "Доступ проверен" : "Доступ ещё не проверен"}
            </Tag>
          </div>
        </div>
        <Button type="primary" icon={<SyncOutlined />} loading={pending} disabled={pending || tagsPending || !status.configured} onClick={check}>
          Проверить сейчас
        </Button>
      </div>
      {initialAutomation && <VkAutomationControls initialState={initialAutomation} configured={status.configured} source={status.source} />}
      <p className="mt-4 text-sm text-gray-600">
        Кнопка однократно проверяет новые публикации после предыдущей проверки и изменения в 30 последних постах. Она работает и при выключенном расписании. Если источник занят, запрос сохраняется в очереди и выполняется после текущей операции. При первом запуске проверяются 30 последних постов; после простоя — все новые публикации.
        Импортируются собственные посты сообщества с тегами сайта и датой от 1 сентября 2026 года. Репосты пропускаются.
      </p>
      <p className="mt-2 text-sm text-gray-600">Правки за пределами окна автоматически не проверяются. Удаление ранее наблюдавшихся постов проверяется отдельно в ограниченном объёме. Старую новость можно проверить действием «Проверить эту новость» в её карточке. Фото сохраняются на сайте, остальные вложения доступны по ссылке на оригинал.</p>
      {tagStatus && tagStatus.revision > 0 && <div className="mt-4 rounded border p-3 text-sm" aria-live="polite">
        <p className="font-medium">{tagStatus.pending ? "Пересмотр тегов ожидает повтора" : "Пересмотр тегов завершён"}</p>
        <p className="mt-1 text-gray-600">Новый или переименованный тег пересматривает только 30 последних постов. Более ранние записи доступны через импорт истории; опубликованные новости сохраняются.</p>
        <p className="mt-1 text-gray-500">Последний успешный пересмотр: {formatTime(tagStatus.lastSuccessAt)}</p>
        {tagStatus.error && <p role="alert" className="mt-2 text-red-700">{tagStatus.error}</p>}
        {tagStatus.pending && <Button className="mt-2" loading={tagsPending} disabled={pending || tagsPending || !status.configured} onClick={retryTags}>Повторить пересмотр тегов</Button>}
      </div>}
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-gray-500">Последняя попытка</dt><dd>{formatTime(status.lastAttemptAt)}</dd></div>
        <div><dt className="text-gray-500">Последняя успешная проверка новых постов</dt><dd>{formatTime(status.lastSuccessAt)}</dd></div>
        <div><dt className="text-gray-500">Последняя успешная проверка изменений (30 постов)</dt><dd>{formatTime(status.lastSyncAt)}</dd></div>
      </dl>
      {synced && <div className="mt-3 text-sm" aria-live="polite"><p className="font-medium">Изменения: {synced.successful ? "проверка завершена" : "проверка завершена с ошибками"}</p><p>Проверено: {synced.checked} · Обновлено: {synced.updated} · Скрыто: {synced.hidden} · Восстановлено: {synced.restored} · Ошибок: {synced.failed}</p></div>}
      {status.error && <p role="alert" className="mt-4 text-red-700">{status.error}</p>}
      {result && <div aria-live="polite" className="mt-4">
        <p className="font-medium">{result.queued ? "Проверка сохранена в очереди" : result.successful ? "Проверка завершена" : "Проверка завершена с ошибками"}</p>
        {result.queued && <p className="mt-1 text-gray-600">Исполнитель продолжит проверку после освобождения источника, в том числе при выключенном расписании.</p>}
        <p className="mt-1">Добавлено: {result.added} · Пропущено: {result.skipped} · Ошибок: {result.failed}</p>
        {!!result.reasons.length && <details className="mt-3"><summary className="cursor-pointer">Причины пропусков и ошибок (до 30)</summary><ul className="mt-2 list-disc pl-5">
          {result.reasons.map((item, index) => <li key={`${item.postId}-${index}`}>Пост {item.postId}: {item.reason}</li>)}
        </ul></details>}
      </div>}
    </Card>
  );
}
