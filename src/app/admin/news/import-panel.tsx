"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Tag } from "antd";
import { SyncOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import type { VkImportStatus } from "@/lib/vk-import/types";
import { checkVkNews } from "./import-actions";

function formatTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Moscow" }).format(new Date(value)) + " МСК" : "Ещё не выполнялась";
}

export default function VkImportPanel({ initialStatus }: { initialStatus: VkImportStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const router = useRouter();
  useEffect(() => { setStatus(initialStatus); }, [initialStatus]);

  async function check() {
    if (running.current || !status.configured) return;
    running.current = true; setPending(true);
    try {
      const result = await checkVkNews();
      if (!result.ok) setStatus((old) => ({ ...old, error: result.error, lastResult: null }));
      else {
        setStatus((old) => ({ ...old, group: result.data.group, lastAttemptAt: result.data.startedAt, lastSuccessAt: result.data.lastSuccessAt, lastResult: result.data, error: result.data.error }));
        router.refresh();
      }
    } catch {
      setStatus((old) => ({ ...old, error: "Не удалось завершить запрос. Повторите проверку.", lastResult: null }));
    } finally { running.current = false; setPending(false); }
  }

  const source = status.group?.screenName ?? status.source;
  const sourcePath = source && /^-?\d+$/.test(source) ? `club${Math.abs(Number(source))}` : source;
  const result = status.lastResult;
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
        <Button type="primary" icon={<SyncOutlined />} loading={pending} disabled={pending || !status.configured} onClick={check}>
          Проверить сейчас
        </Button>
      </div>
      <p className="mt-4 text-sm text-gray-600">
        Кнопка проверяет новые публикации после предыдущей проверки. При первом запуске проверяются 30 последних постов; после простоя — все новые публикации.
        Импортируются собственные посты сообщества с тегами сайта и датой от 1 сентября 2026 года. Репосты пропускаются.
      </p>
      <p className="mt-2 text-sm text-gray-600">Редактирования ранее импортированных новостей и более старый архив этой проверкой пока не обрабатываются. Фото сохраняются на сайте, остальные вложения доступны по ссылке на оригинал.</p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-gray-500">Последняя попытка</dt><dd>{formatTime(status.lastAttemptAt)}</dd></div>
        <div><dt className="text-gray-500">Последняя успешная проверка</dt><dd>{formatTime(status.lastSuccessAt)}</dd></div>
      </dl>
      {status.error && <p role="alert" className="mt-4 text-red-700">{status.error}</p>}
      {result && <div aria-live="polite" className="mt-4">
        <p className="font-medium">{result.successful ? "Проверка завершена" : "Проверка завершена с ошибками"}</p>
        <p className="mt-1">Добавлено: {result.added} · Пропущено: {result.skipped} · Ошибок: {result.failed}</p>
        {!!result.reasons.length && <details className="mt-3"><summary className="cursor-pointer">Причины пропусков и ошибок (до 30)</summary><ul className="mt-2 list-disc pl-5">
          {result.reasons.map((item, index) => <li key={`${item.postId}-${index}`}>Пост {item.postId}: {item.reason}</li>)}
        </ul></details>}
      </div>}
    </Card>
  );
}
