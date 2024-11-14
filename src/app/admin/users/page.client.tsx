"use client";

import { Button, Popconfirm, Space, Table } from "antd";
import IsAdmin from "./is-admin";
import { User } from "@/lib/db/client";
import { TrashIcon } from "lucide-react";

export default function UsersClient({
  userId,
  users = [],
}: {
  userId?: string;
  users: User[];
}) {
  return (
    <Table
      dataSource={users}
      rowKey={"id"}
      pagination={{ pageSize: 30 }}
      columns={[
        {
          title: "Email",
          dataIndex: "email",
        },
        {
          title: "Role",
          dataIndex: "role",
          width: 150,
          filters: [
            { text: "Admin", value: "admin" },
            { text: "User", value: "user" },
          ],
          sorter: true,
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
          title: "Actions",
          width: 150,
          render: (_, record) => (
            <Space>
              <Popconfirm title="Are you sure?">
                <Button
                  danger
                  disabled={userId === record.id}
                  icon={<TrashIcon />}
                />
              </Popconfirm>
            </Space>
          ),
        },
      ]}
    />
  );
}
