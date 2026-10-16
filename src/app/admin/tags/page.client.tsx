"use client";

import type { NewsTags } from "@/lib/db/client";
import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, List, Popconfirm, Space } from "antd";
import { useState } from "react";
import { addNewsTags, deleteNewsTags, updateNewsTags } from "./actions";
import { useAction } from "@/lib/use-action";
import { usePendingAction } from "@/lib/use-pending-action";
import { getNewsTagError, getStoredNewsTagIssue, normalizeNewsTagTitle } from "@/lib/news-tags";
import { ListSearch } from "../list-search";

export default function NewsTagsClient({ newsTags }: { newsTags: NewsTags[] }) {
  const runAction = useAction();
  const { run, pending } = usePendingAction();
  const [currentItem, setCurrentItem] = useState<NewsTags>();
  const [form] = Form.useForm();
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase("ru");
  const filtered = newsTags.filter(item => item.title.toLocaleLowerCase("ru").includes(search));
  const editError = currentItem ? getNewsTagError(currentItem.title, newsTags, currentItem.id) : undefined;

  return (
    <Space orientation="vertical" className="w-full">
      <p className="text-sm text-gray-600">
        Название без пробелов: русские и латинские буквы, цифры и _. До 30 символов.
        Например, НаучныеИсследования. Начальный # убирается автоматически.
      </p>
      <Form
        form={form}
        disabled={pending.has("add")}
        className="w-full"
        onFinish={(values) =>
          run("add", () => addNewsTags(values.title), () => form.resetFields())
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Form.Item
            name="title"
            normalize={normalizeNewsTagTitle}
            className="!mb-0 flex-1"
            rules={[
              {
                validator: (_, value) => {
                  const error = getNewsTagError(value, newsTags);
                  return error ? Promise.reject(new Error(error)) : Promise.resolve();
                },
              },
            ]}
          >
            <Input maxLength={31} placeholder="Название" aria-label="Название нового тега" />
          </Form.Item>
          <Button htmlType="submit" type="primary" disabled={pending.has("add")} loading={pending.has("add")}>
            Добавить
          </Button>
        </div>
      </Form>
      <ListSearch value={query} onChange={setQuery} foundCount={filtered.length} placeholder="Поиск по названию тега" />
      <div hidden={filtered.length === 0}>
      <List
        dataSource={filtered}
        locale={{ emptyText: null }}
        renderItem={(item) => {
          const issue = getStoredNewsTagIssue(item, newsTags);
          const isEditing =
            (currentItem && currentItem.id === item.id) ?? false;
          const isEditingNotCurrent = currentItem && currentItem.id !== item.id;

          return (
            <List.Item key={item.id}>
              <div className="flex w-full items-start gap-3">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <Input
                      maxLength={31}
                      aria-label={`Название тега ${item.title}`}
                      aria-invalid={Boolean(editError)}
                      aria-describedby={editError ? `tag-error-${item.id}` : undefined}
                      status={editError ? "error" : undefined}
                      disabled={pending.has("save")}
                      value={currentItem?.title}
                      onChange={(e) =>
                        setCurrentItem((i) => ({ ...i!, title: normalizeNewsTagTitle(e.target.value) }))
                      }
                    />
                  ) : (
                    item.title
                  )}
                  {isEditing && editError && (
                    <p id={`tag-error-${item.id}`} role="alert" className="mt-1 text-sm text-red-600">
                      {editError}
                    </p>
                  )}
                  {!isEditing && issue && (
                    <p role="alert" className="mt-1 text-sm text-red-600">
                      Требуется исправление: {issue}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="small"
                    type="text"
                    disabled={isEditingNotCurrent || pending.has("save") || (isEditing && Boolean(editError))}
                    onClick={() => {
                      if (!isEditing) setCurrentItem(item);
                      else {
                        run("save", () => updateNewsTags(currentItem!), () =>
                          setCurrentItem(undefined)
                        );
                      }
                    }}
                    loading={isEditing && pending.has("save")}
                    icon={isEditing ? <SaveOutlined /> : <EditOutlined />}
                    aria-label={`${isEditing ? "Сохранить" : "Редактировать"}: ${item.title}`}
                    title={isEditing ? "Сохранить" : "Редактировать"}
                  />
                  <Popconfirm
                    title={`Удалить тег «${item.title}»?`}
                    description="Тег будет удалён из новостей. Новости сохранятся."
                    okText="Удалить"
                    cancelText="Отмена"
                    disabled={isEditing}
                    onConfirm={() => {
                      if (isEditing) return setCurrentItem(undefined);
                      else return runAction(deleteNewsTags(item.id));
                    }}
                  >
                    <Button
                      size="small"
                      type="text"
                      danger
                      disabled={isEditingNotCurrent || pending.has("save")}
                      icon={isEditing ? <CloseOutlined /> : <DeleteOutlined />}
                      aria-label={`${isEditing ? "Отменить редактирование" : "Удалить"}: ${item.title}`}
                      title={isEditing ? "Отмена" : "Удалить"}
                      onClick={isEditing ? () => setCurrentItem(undefined) : undefined}
                    />
                  </Popconfirm>
                </div>
              </div>
            </List.Item>
          );
        }}
      />
      </div>
    </Space>
  );
}
