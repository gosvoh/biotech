"use client";

import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { Button, Image, Popconfirm, Space, Table } from "antd";
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
      columns={[
        {
          title: "Фото",
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
          title: "ФИО",
          render: (_, record: MemberWithRelations) =>
            `${record.lastName} ${record.firstName} ${
              record.middleName ?? ""
            }`.trim(),
        },
        {
          title: "Подразделение и должность",
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
          title: "Дисциплины",
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
          title: "Научные работы",
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
          title: "Эл. почта и телефон",
          width: 200,
          render: (_, record: MemberWithRelations) => (
            <Space orientation="vertical">
              {record.email}
              {record.phone}
            </Space>
          ),
        },
        {
          title: "Действия",
          width: 100,
          render: (_, record: MemberWithRelations) => (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => onEdit(record)} />
              <Button
                icon={<CopyOutlined />}
                onClick={() => runAction(duplicateMember(record.id))}
              />
              <Popconfirm
                title="Удалить?"
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
