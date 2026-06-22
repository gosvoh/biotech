"use client";

import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { Button, Card, Image, Popconfirm, Space } from "antd";
import { useMemo } from "react";
import { ResponsiveTable } from "../responsive-table";
import { CollapsibleList } from "./collapsible-list";
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

  const renderCardList = (
    label: string,
    items: { id: string; title: string }[],
  ) =>
    items.length > 0 && (
      <div className="mt-3">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
          {label}
        </div>
        <CollapsibleList items={items} />
      </div>
    );

  const renderMemberCard = (record: MemberWithRelations) => {
    const fullName = `${record.lastName} ${record.firstName} ${
      record.middleName ?? ""
    }`.trim();
    const department = departments.find(
      (d) => d.id === record.departmentId,
    )?.name;
    const subtitle = [department, record.position].filter(Boolean).join(" · ");
    const contact = [record.email, record.phone].filter(Boolean).join(" · ");

    return (
      <Card size="small">
        <div className="flex items-start gap-3">
          <Image
            key={`member-image-${record.id}-${trigger}`}
            width={56}
            height={56}
            src={`/uploads/members/${record.image ?? record.id}.webp`}
            className="rounded-full object-cover"
            alt={fullName}
          />
          <div className="min-w-0 flex-1">
            <div className="font-semibold leading-snug">{fullName}</div>
            {subtitle && (
              <div className="mt-0.5 text-sm text-gray-500">{subtitle}</div>
            )}
            {contact && (
              <div className="mt-0.5 text-sm text-gray-500">{contact}</div>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
            />
            <Button
              size="small"
              type="text"
              icon={<CopyOutlined />}
              onClick={() => runAction(duplicateMember(record.id))}
            />
            <Popconfirm
              title="Удалить?"
              onConfirm={() => runAction(deleteMember(record.id))}
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>
        </div>

        {renderCardList("Дисциплины", record.disciplines)}
        {renderCardList("Научные работы", record.scientificWorks)}
      </Card>
    );
  };

  return (
    <ResponsiveTable
      dataSource={members}
      rowKey="id"
      pagination={{ pageSize: 30, hideOnSinglePage: true }}
      renderCard={renderMemberCard}
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
          width: 220,
          render: (_, record: MemberWithRelations) => (
            <CollapsibleList items={record.disciplines} />
          ),
        },
        {
          title: "Научные работы",
          width: 280,
          render: (_, record: MemberWithRelations) => (
            <CollapsibleList items={record.scientificWorks} />
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

