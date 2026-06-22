"use client";

import { Button, Card, Descriptions, Popconfirm, Space } from "antd";
import type { DescriptionsProps } from "antd";
import IsAdmin from "./is-admin";
import type { User } from "@/lib/db/client";
import { deleteUser } from "./actions";
import { DeleteOutlined } from "@ant-design/icons";
import { useAction } from "@/lib/use-action";
import { ResponsiveTable } from "../responsive-table";

export default function UsersClient({
  userId,
  users = [],
}: {
  userId?: string;
  users: User[];
}) {
  const runAction = useAction();

  const renderUserCard = (record: User) => {
    const items: DescriptionsProps["items"] = [
      {
        key: "role",
        label: "Роль",
        children: (
          <IsAdmin
            userId={record.id}
            canChangeRole={userId !== record.id}
            role={record.role}
          />
        ),
      },
    ];

    return (
      <Card size="small">
        <div className="font-semibold break-all">{record.email}</div>
        <Descriptions column={1} size="small" className="mt-2" items={items} />
        <div className="mt-3 flex justify-end">
          <Popconfirm
            title="Удалить?"
            onConfirm={() => runAction(deleteUser(record.id))}
          >
            <Button
              danger
              disabled={userId === record.id}
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </div>
      </Card>
    );
  };

  return (
    <ResponsiveTable
      dataSource={users}
      rowKey={"id"}
      pagination={{ pageSize: 30 }}
      renderCard={renderUserCard}
      columns={[
        {
          title: "Эл. почта",
          dataIndex: "email",
        },
        {
          title: "Роль",
          dataIndex: "role",
          width: 150,
          filters: [
            { text: "Администратор", value: "admin" },
            { text: "Пользователь", value: "user" },
          ],
          onFilter: (value, record) => record.role === value,
          sorter: (a, b) => a.role.localeCompare(b.role),
          sortDirections: ["descend", "ascend"],
          render: (_, record) => (
            <IsAdmin
              userId={record.id}
              canChangeRole={userId !== record.id}
              role={record.role}
            />
          ),
        },
        {
          title: "Действия",
          width: 150,
          render: (_, record) => (
            <Space>
              <Popconfirm
                title="Удалить?"
                onConfirm={() => runAction(deleteUser(record.id))}
              >
                <Button
                  danger
                  disabled={userId === record.id}
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            </Space>
          ),
        },
      ]}
    />
  );
}
