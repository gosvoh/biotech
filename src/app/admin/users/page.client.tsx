"use client";

import { Button, Popconfirm, Space, Table } from "antd";
import IsAdmin from "./is-admin";
import type { User } from "@/lib/db/client";
import { deleteUser } from "./actions";
import { DeleteOutlined } from "@ant-design/icons";
import { useAction } from "@/lib/use-action";

export default function UsersClient({
  userId,
  users = [],
}: {
  userId?: string;
  users: User[];
}) {
  const runAction = useAction();

  return (
    <Table
      dataSource={users}
      rowKey={"id"}
      pagination={{ pageSize: 30 }}
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
