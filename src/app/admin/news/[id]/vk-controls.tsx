"use client";
import { useState } from "react";
import { Button, Card, Checkbox, Popconfirm, Space, Tag } from "antd";
import { useRouter } from "next/navigation";
import { useAction } from "@/lib/use-action";
import type { VkNewsState } from "@/lib/vk-import/types";
import { checkVkNewsPost, disableVkNewsSync, enableVkNewsSync } from "../vk-actions";
import { changeVisibility } from "../actions";
import type { ActionResult } from "@/lib/action-result";

export default function VkNewsControls({ newsId, state, canCheck = true }: { newsId: string; state: VkNewsState; canCheck?: boolean }) {
  const [pending, setPending] = useState(false);
  const run = useAction();
  const router = useRouter();
  async function perform<T>(action: () => Promise<ActionResult<T>>) {
    if (pending) return;
    setPending(true);
    try { await run(action(), () => router.refresh()); } finally { setPending(false); }
  }
  return <Card className="mb-5" title="Синхронизация с ВК">
    <a href={`https://vk.ru/wall-${state.groupId}_${state.postId}`} target="_blank" rel="noopener noreferrer">Оригинал новости в ВК ↗</a>
    <div className="my-3"><Tag color={state.syncEnabled ? "blue" : "default"}>{state.syncEnabled ? "Синхронизация включена" : "Самостоятельная редактура"}</Tag>{state.manualHidden && <Tag color="orange">Скрыта редактором</Tag>}</div>
    <p className="text-sm text-gray-600">Обновляет содержимое этой новости из оригинала. Отключите, чтобы редактировать её на сайте. Ручное скрытие сохраняется при проверках.</p>
    {state.autoHiddenReason && <p className="mt-3 text-orange-800">Автоматическое скрытие: {state.autoHiddenReason}</p>}
    <p className="my-3 text-sm">Последняя успешная проверка: {state.lastCheckedAt ? new Intl.DateTimeFormat("ru-RU", {dateStyle:"short", timeStyle:"short", timeZone:"Europe/Moscow"}).format(new Date(state.lastCheckedAt)) + " МСК" : "Ещё не выполнялась"}</p>
    {state.lastCheckError && <p role="alert" className="my-3 text-red-700">{state.lastCheckError}</p>}
    {!canCheck && <p className="my-3 text-sm text-gray-600">Проверка доступна только для текущего источника с настроенным подключением. Самостоятельную редактуру можно включить отключением синхронизации.</p>}
    <Space wrap>
      <Button disabled={pending || !canCheck} loading={pending} onClick={() => perform(() => checkVkNewsPost(newsId))}>Проверить эту новость</Button>
      {state.syncEnabled ? <Button disabled={pending} onClick={() => perform(() => disableVkNewsSync(newsId))}>Отключить синхронизацию</Button> : <Popconfirm title="Заменить ручные правки версией ВК?" description="Ручные правки текста и фотографий будут заменены после успешной загрузки. Ручное скрытие сохранится." okText="Включить и заменить" cancelText="Отмена" disabled={pending || !canCheck} onConfirm={() => perform(() => enableVkNewsSync(newsId))}>
        <Button disabled={pending || !canCheck}>Включить синхронизацию</Button>
      </Popconfirm>}
      <Checkbox disabled={pending} checked={state.manualHidden} onChange={(event) => perform(() => changeVisibility(newsId, event.target.checked))}>Скрыть вручную</Checkbox>
    </Space>
    <p className="mt-3 text-sm text-gray-600">«Проверить эту новость» проверяет оригинал вне окна 30 последних постов. При отключённой синхронизации ручной текст и фото сохраняются.</p>
  </Card>;
}
