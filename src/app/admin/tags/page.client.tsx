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
import { getNewsTagError, getStoredNewsTagIssue, normalizeNewsTagTitle } from "@/lib/news-tags";

export default function NewsTagsClient({ newsTags }: { newsTags: NewsTags[] }) {
  const runAction = useAction();
  const [currentItem, setCurrentItem] = useState<NewsTags>();
  const [form] = Form.useForm();
  const input = Form.useWatch("title", form);
  const editError = currentItem ? getNewsTagError(currentItem.title, newsTags, currentItem.id) : undefined;

  return (
    <Space orientation="vertical" className="w-full">
      <p className="text-sm text-gray-600">
        Название без пробелов: русские и латинские буквы, цифры и _. До 30 символов.
        Например, НаучныеИсследования. Начальный # убирается автоматически.
      </p>
      <Form
        form={form}
        className="w-full"
        onFinish={(values) =>
          runAction(addNewsTags(values.title), () => form.resetFields())
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
          <Button htmlType="submit" type="primary">
            Добавить
          </Button>
        </div>
      </Form>
      <List
        dataSource={newsTags.filter((d) =>
          d.title.toLowerCase().includes(input?.toLowerCase() ?? "")
        )}
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
                    disabled={isEditingNotCurrent || (isEditing && Boolean(editError))}
                    onClick={() => {
                      if (!isEditing) setCurrentItem(item);
                      else {
                        runAction(updateNewsTags(currentItem!), () =>
                          setCurrentItem(undefined)
                        );
                      }
                    }}
                    icon={isEditing ? <SaveOutlined /> : <EditOutlined />}
                  />
                  <Popconfirm
                    title="Удалить?"
                    onConfirm={() => {
                      if (isEditing) return setCurrentItem(undefined);
                      else return runAction(deleteNewsTags(item.id));
                    }}
                  >
                    <Button
                      size="small"
                      type="text"
                      danger
                      disabled={isEditingNotCurrent}
                      icon={isEditing ? <CloseOutlined /> : <DeleteOutlined />}
                    />
                  </Popconfirm>
                </div>
              </div>
            </List.Item>
          );
        }}
      />
    </Space>
  );
}
