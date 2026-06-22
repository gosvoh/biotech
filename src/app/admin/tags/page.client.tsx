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

export default function NewsTagsClient({ newsTags }: { newsTags: NewsTags[] }) {
  const runAction = useAction();
  const [currentItem, setCurrentItem] = useState<NewsTags>();
  const [form] = Form.useForm();
  const input = Form.useWatch("title", form);

  return (
    <Space orientation="vertical" className="w-full">
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
            className="!mb-0 flex-1"
            rules={[
              { required: true, message: "Укажите название" },
              {
                validator: (_, value) => {
                  if (newsTags.some((d) => d.title === value))
                    return Promise.reject(
                      new Error("Название должно быть уникальным"),
                    );
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input maxLength={30} placeholder="Название" />
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
          const isEditing =
            (currentItem && currentItem.id === item.id) ?? false;
          const isEditingNotCurrent = currentItem && currentItem.id !== item.id;

          return (
            <List.Item key={item.id}>
              <div className="flex w-full items-start gap-3">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <Input
                      value={currentItem?.title}
                      onChange={(e) =>
                        setCurrentItem((i) => ({ ...i!, title: e.target.value }))
                      }
                    />
                  ) : (
                    item.title
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="small"
                    type="text"
                    disabled={isEditingNotCurrent}
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
