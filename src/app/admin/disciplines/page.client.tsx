"use client";

import type { Discipline } from "@/lib/db/client";
import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, List, Popconfirm, Space } from "antd";
import { useState } from "react";
import { addDiscipline, deleteDiscipline, updateDiscipline } from "./actions";
import { useAction } from "@/lib/use-action";
import { usePendingAction } from "@/lib/use-pending-action";
import { ListSearch } from "../list-search";

export default function DisciplinesClient({
  disciplines,
}: {
  disciplines: Discipline[];
}) {
  const runAction = useAction();
  const { run, pending } = usePendingAction();
  const [currentItem, setCurrentItem] = useState<Discipline>();
  const [form] = Form.useForm();
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase("ru");
  const filtered = disciplines.filter(item => item.title.toLocaleLowerCase("ru").includes(search));

  return (
    <Space orientation="vertical" className="w-full">
      <Form
        form={form}
        disabled={pending.has("add")}
        className="w-full"
        onFinish={(values) =>
          run("add", () => addDiscipline(values.title), () => form.resetFields())
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
                  if (disciplines.some((d) => d.title === value))
                    return Promise.reject(
                      new Error("Название должно быть уникальным"),
                    );
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input placeholder="Название" aria-label="Название новой дисциплины" />
          </Form.Item>
          <Button htmlType="submit" type="primary" disabled={pending.has("add")} loading={pending.has("add")}>
            Добавить
          </Button>
        </div>
      </Form>
      <ListSearch value={query} onChange={setQuery} foundCount={filtered.length} placeholder="Поиск по названию дисциплины" />
      <div hidden={filtered.length === 0}>
      <List
        dataSource={filtered}
        locale={{ emptyText: null }}
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
                      aria-label={`Название дисциплины ${item.title}`}
                      disabled={pending.has("save")}
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
                    disabled={isEditingNotCurrent || pending.has("save")}
                    onClick={() => {
                      if (!isEditing) setCurrentItem(item);
                      else {
                        run("save", () => updateDiscipline(currentItem!), () =>
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
                    title={`Удалить дисциплину «${item.title}»?`}
                    description="Дисциплина будет удалена из карточек сотрудников. Сотрудники сохранятся."
                    okText="Удалить"
                    cancelText="Отмена"
                    disabled={isEditing}
                    onConfirm={() => {
                      if (isEditing) return setCurrentItem(undefined);
                      else return runAction(deleteDiscipline(item.id));
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
