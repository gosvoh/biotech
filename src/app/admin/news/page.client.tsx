"use client";

import type { News, NewsTags } from "@/lib/db/client";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Checkbox,
  FloatButton,
  Image,
  Popconfirm,
  Space,
  Tag,
} from "antd";
import Link from "next/link";
import { changeVisibility, deleteNews } from "./actions";
import { useAction } from "@/lib/use-action";
import { usePendingAction } from "@/lib/use-pending-action";
import { ResponsiveTable } from "../responsive-table";
import { ListSearch } from "../list-search";
import { useState } from "react";

const IMAGE_FALLBACK =
  "data:image/png;base64,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";

export default function NewsClient({
  news,
}: {
  news: (Omit<News, "text" | "createdAt" | "updatedAt"> & {
    tags: NewsTags[];
    images: { id: string }[];
    vkImport?: {groupId:string;postId:string;syncEnabled:boolean;manualHidden:boolean;autoHiddenReason:string|null} | null;
  })[];
}) {
  const runAction = useAction();
  const { run, pending } = usePendingAction();
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase("ru");
  const filtered = news.filter(record => [record.title, ...record.tags.map(tag => tag.title)].join(" ").toLocaleLowerCase("ru").includes(search));

  const renderNewsCard = (record: (typeof news)[number]) => (
    <Card size="small">
      <div className="flex items-start gap-3">
        <Image
          width={56}
          height={56}
          src={
            record.images[0]?.id
              ? `/uploads/news/${record.images[0].id}.webp`
              : undefined
          }
          fallback={IMAGE_FALLBACK}
          className="rounded-lg object-cover"
          alt={record.title}
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{record.title}</div>
          {record.vkImport && <p className="mt-1 text-sm text-gray-500">{record.vkImport.autoHiddenReason ? `Скрыта автоматически: ${record.vkImport.autoHiddenReason}` : record.vkImport.syncEnabled ? "ВК: синхронизация включена" : "ВК: самостоятельная редактура"}</p>}
          <div className="mt-1 flex flex-wrap gap-1">
            {record.tags.map((t) => (
              <Tag key={`tag-${record.id}-${t.id}`}>{t.title}</Tag>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Checkbox
          disabled={pending.has(record.id)}
          aria-busy={pending.has(record.id)}
          checked={record.vkImport?.manualHidden ?? record.hidden}
          onChange={(v) => {
            const hidden = v.target.checked;
            return run(record.id, () => changeVisibility(record.id, hidden));
          }}
        >
          Скрыть вручную
        </Checkbox>
        <div className="flex gap-2">
          <Link href={`/admin/news/${record.id}`}>
            <Button icon={<EditOutlined />} aria-label={`Редактировать: ${record.title}`} title="Редактировать" />
          </Link>
          <Popconfirm
            title={`Удалить новость «${record.title}»?`}
            okText="Удалить"
            cancelText="Отмена"
            description={record.vkImport ? "Пост будет исключён из повторного импорта. Снять запрет можно в блоке «Исключённые посты ВК»." : undefined}
            onConfirm={() => runAction(deleteNews(record.id))}
          >
            <Button danger icon={<DeleteOutlined />} aria-label={`Удалить: ${record.title}`} title="Удалить" />
          </Popconfirm>
        </div>
      </div>
    </Card>
  );

  return (
    <>
      <ListSearch value={query} onChange={setQuery} foundCount={filtered.length} placeholder="Поиск по заголовку или тегам новости" />
      <div hidden={filtered.length === 0}>
      <ResponsiveTable
        dataSource={filtered}
        resetKey={search}
        rowKey="id"
        pagination={{ pageSize: 30, hideOnSinglePage: true }}
        renderCard={renderNewsCard}
        columns={[
          {
            title: "Фото",
            width: 100,
            render: (_, record) => (
              <Image
                width={100}
                height={100}
                src={
                  record.images[0]?.id
                    ? `/uploads/news/${record.images[0].id}.webp`
                    : undefined
                }
                className="object-cover rounded-lg"
                alt={record.title}
                fallback={IMAGE_FALLBACK}
              />
            ),
          },
          {
            title: "Название",
            render: (_, record) => <div>{record.title}{record.vkImport && <p className="mt-1 text-sm text-gray-500">{record.vkImport.autoHiddenReason ? `Скрыта автоматически: ${record.vkImport.autoHiddenReason}` : record.vkImport.syncEnabled ? "ВК: синхронизация включена" : "ВК: самостоятельная редактура"}</p>}</div>,
            width: 200,
          },
          {
            title: "Теги",
            width: 200,
            render: (_, record) => (
              <Space orientation="vertical">
                {record.tags.map((x) => (
                  <Tag key={`tag-${record.id}-${x.id}`}>{x.title}</Tag>
                ))}
              </Space>
            ),
          },
          {
            title: "Скрыть вручную",
            width: 100,

            render: (_, record) => (
              <Checkbox
                aria-label={`Скрыть вручную: ${record.title}`}
                disabled={pending.has(record.id)}
                aria-busy={pending.has(record.id)}
                checked={record.vkImport?.manualHidden ?? record.hidden}
                onChange={(v) => {
                  const hidden = v.target.checked;
                  return run(record.id, () => changeVisibility(record.id, hidden));
                }}
              />
            ),
          },
          {
            title: "Действия",
            width: 100,
            render: (_, record) => (
              <Space>
                <Link href={`/admin/news/${record.id}`}>
                  <Button icon={<EditOutlined />} aria-label={`Редактировать: ${record.title}`} title="Редактировать" />
                </Link>
                <Popconfirm
                  title={`Удалить новость «${record.title}»?`}
                  okText="Удалить"
                  cancelText="Отмена"
            description={record.vkImport ? "Пост будет исключён из повторного импорта. Снять запрет можно в блоке «Исключённые посты ВК»." : undefined}
                  onConfirm={() => runAction(deleteNews(record.id))}
                >
                  <Button danger icon={<DeleteOutlined />} aria-label={`Удалить: ${record.title}`} title="Удалить" />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      </div>
      <Link href="/admin/news/new" className="contents">
        <FloatButton icon={<PlusOutlined />} type="primary" />
      </Link>
    </>
  );
}
