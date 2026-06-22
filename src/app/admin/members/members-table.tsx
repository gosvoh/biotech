"use client";

import {
  ArrowLeftOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { Button, Image, Popconfirm, Space, Table } from "antd";
import Link from "next/link";
import React, { useMemo } from "react";
import type { Department } from "@/lib/db/client";
import { deleteMember, duplicateMember } from "./actions";
import type { MemberWithRelations } from "./types";
import { useAction } from "@/lib/use-action";

type MembersTableProps = {
  members: MemberWithRelations[];
  departments: Department[];
  onEdit: (member: MemberWithRelations) => void;
};

export function MembersTable({ members, departments, onEdit }: MembersTableProps) {
  const runAction = useAction();
  const trigger = useMemo(
    () => members.map((member) => member.id).join(":"),
    [members],
  );

  return (
    <Table
      dataSource={members}
      rowKey="id"
      pagination={{ pageSize: 30, hideOnSinglePage: true }}
      title={() => (
        <Link href="/admin">
          <Button icon={<ArrowLeftOutlined />} type="primary">
            Back
          </Button>
        </Link>
      )}
      columns={[
        {
          title: "Image",
          dataIndex: "image",
          width: 100,
          render: (image: string | null, record: MemberWithRelations) => (
            <Image
              key={`member-image-${record.id}-${trigger}`}
              width={100}
              height={100}
              src={`/uploads/members/${image ?? record.id}.webp`}
              className="object-cover rounded-full"
              alt={[
                record.firstName,
                record.middleName,
                record.lastName,
              ].join(" ")}
            />
          ),
        },
        {
          title: "Name",
          render: (_, record: MemberWithRelations) =>
            `${record.lastName} ${record.firstName} ${
              record.middleName ?? ""
            }`.trim(),
        },
        {
          title: "Department & Position",
          width: 200,
          render: (_, record: MemberWithRelations) => (
            <Space orientation="vertical">
              {departments.find((department) => department.id === record.departmentId)
                ?.name}
              {record.position}
            </Space>
          ),
        },
        {
          title: "Disciplines",
          width: 200,
          render: (_, record: MemberWithRelations) => (
            <Space orientation="vertical">
              {record.disciplines.map((discipline) => (
                <React.Fragment key={discipline.id}>
                  {discipline.title}
                </React.Fragment>
              ))}
            </Space>
          ),
        },
        {
          title: "Scientific Works",
          width: 200,
          render: (_, record: MemberWithRelations) => (
            <Space orientation="vertical">
              {record.scientificWorks.map((scientificWork) => (
                <React.Fragment key={scientificWork.id}>
                  {scientificWork.title}
                </React.Fragment>
              ))}
            </Space>
          ),
        },
        {
          title: "Email & Phone",
          width: 200,
          render: (_, record: MemberWithRelations) => (
            <Space orientation="vertical">
              {record.email}
              {record.phone}
            </Space>
          ),
        },
        {
          title: "Actions",
          width: 100,
          render: (_, record: MemberWithRelations) => (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => onEdit(record)} />
              <Button
                icon={<CopyOutlined />}
                onClick={() => runAction(duplicateMember(record.id))}
              />
              <Popconfirm
                title="Are you sure?"
                onConfirm={() => runAction(deleteMember(record.id))}
              >
                <Button danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          ),
        },
      ]}
    />
  );
}
