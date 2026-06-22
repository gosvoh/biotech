"use client";

import { Button, Popconfirm, Space, Table } from "antd";
import IsAdmin from "./is-admin";
import type { User } from "@/lib/db/client";
import { deleteUser } from "./actions";
import { ArrowLeftOutlined, DeleteOutlined } from "@ant-design/icons";
import Link from "next/link";
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
      title={() => (
        <Link href="/admin">
          <Button icon={<ArrowLeftOutlined />} type="primary">
            Back
          </Button>
        </Link>
      )}
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
          title: "Actions",
          width: 150,
          render: (_, record) => (
            <Space>
              <Popconfirm
                title="Are you sure?"
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
