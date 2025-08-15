"use client";

import type { Discipline } from "@/lib/db/client";
import {
  ArrowLeftOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, List, Popconfirm, Space } from "antd";
import { useState } from "react";
import { addDiscipline, deleteDiscipline, updateDiscipline } from "./actions";
import Link from "next/link";

export default function DisciplinesClient({
  disciplines,
}: {
  disciplines: Discipline[];
}) {
  const [currentItem, setCurrentItem] = useState<Discipline>();
  const [form] = Form.useForm();
  const input = Form.useWatch("title", form) as string | undefined;

  return (
    <Space direction="vertical" className="w-full">
      <Link href="/admin">
        <Button icon={<ArrowLeftOutlined />} type="primary">
          Back
        </Button>
      </Link>
      <Form
        form={form}
        layout="inline"
        className="w-full"
        onFinish={(values) =>
          addDiscipline(values.title).then(() => form.resetFields())
        }
      >
        <Form.Item
          name="title"
          label="Title"
          className="!flex-1"
          rules={[
            { required: true, message: "Title is required" },
            {
              validator: (_, value) => {
                if (disciplines.some((d) => d.title === value))
                  return Promise.reject(new Error("Title must be unique"));
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Button htmlType="submit" type="primary">
          Add
        </Button>
      </Form>
      <List
        dataSource={disciplines.filter((d) =>
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
                      updateDiscipline(currentItem!).then(() =>
                        setCurrentItem(undefined)
                      );
                    }
                  }}
                  icon={isEditing ? <SaveOutlined /> : <EditOutlined />}
                />,
                <Popconfirm
                  key={`delete-btn-${item.id}`}
                  title="Are you sure?"
                  onConfirm={() => {
                    if (isEditing) return setCurrentItem(undefined);
                    else return deleteDiscipline(item.id);
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
