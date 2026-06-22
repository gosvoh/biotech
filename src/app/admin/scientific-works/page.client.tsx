"use client";

import type { ScientificWork } from "@/lib/db/client";
import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, List, Popconfirm, Space } from "antd";
import { useState } from "react";
import {
  addScientificWork,
  updateScientificWork,
  deleteScientificWork,
} from "./actions";
import { useAction } from "@/lib/use-action";

export default function ScientificWorksClient({
  scientificWorks,
}: {
  scientificWorks: ScientificWork[];
}) {
  const runAction = useAction();
  const [currentItem, setCurrentItem] = useState<ScientificWork>();
  const [form] = Form.useForm();
  const input = Form.useWatch("title", form) as string | undefined;

  return (
    <Space orientation="vertical" className="w-full">
      <Form
        form={form}
        layout="inline"
        className="w-full"
        onFinish={(values) =>
          runAction(addScientificWork(values.title), () => form.resetFields())
        }
      >
        <Form.Item
          name="title"
          label="Название"
          className="!flex-1"
          rules={[
            { required: true, message: "Укажите название" },
            {
              validator: (_, value) => {
                if (scientificWorks.some((d) => d.title === value))
                  return Promise.reject(new Error("Название должно быть уникальным"));
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Button htmlType="submit" type="primary">
          Добавить
        </Button>
      </Form>
      <List
        dataSource={scientificWorks.filter((d) =>
          d.title.toLowerCase().includes(input?.toLowerCase() ?? "")
        )}
        renderItem={(item) => {
          const isEditing =
            (currentItem && currentItem.id === item.id) ?? false;
          const isEditingNotCurrent = currentItem && currentItem.id !== item.id;

          return (
            <List.Item
              key={item.id}
              actions={[
                <Button
                  key={`edit-btn-${item.id}`}
                  disabled={isEditingNotCurrent}
                  onClick={() => {
                    if (!isEditing) setCurrentItem(item);
                    else {
                      runAction(updateScientificWork(currentItem!), () =>
                        setCurrentItem(undefined)
                      );
                    }
                  }}
                  icon={isEditing ? <SaveOutlined /> : <EditOutlined />}
                />,
                <Popconfirm
                  key={`delete-btn-${item.id}`}
                  title="Удалить?"
                  onConfirm={() => {
                    if (isEditing) return setCurrentItem(undefined);
                    else return runAction(deleteScientificWork(item.id));
                  }}
                >
                  <Button
                    danger
                    disabled={isEditingNotCurrent}
                    icon={isEditing ? <CloseOutlined /> : <DeleteOutlined />}
                  />
                </Popconfirm>,
              ]}
            >
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
            </List.Item>
          );
        }}
      />
    </Space>
  );
}
