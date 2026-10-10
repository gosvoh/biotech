"use client";

import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { App, Button, Empty, Modal } from "antd";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "@/lib/use-action";
import { reorderMembers } from "./actions";
import type { MembersClientProps } from "./types";

type Props = Pick<MembersClientProps, "members" | "departments"> & {
  close: () => void;
};

// Mounted afresh on each open so cancelled drafts never leak into the next edit.
export function MemberOrderModal({ members, departments, close }: Props) {
  const [groups, setGroups] = useState(() => [
    ...departments.map((department) => ({
      departmentId: department.id as string | null,
      name: department.name,
      members: members.filter(
        (member) => member.departmentId === department.id,
      ),
      changed: false,
    })),
    {
      departmentId: null,
      name: "Без подразделения",
      members: members.filter((member) => member.departmentId === null),
      changed: false,
    },
  ]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const runAction = useAction();
  const { message } = App.useApp();
  const router = useRouter();

  function move(groupIndex: number, index: number, direction: -1 | 1) {
    setGroups((current) =>
      current.map((group, i) => {
        if (i !== groupIndex) return group;
        const next = [...group.members];
        const target = index + direction;
        if (target < 0 || target >= next.length) return group;
        [next[index], next[target]] = [next[target], next[index]];
        return { ...group, members: next, changed: true };
      }),
    );
  }

  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await runAction(
        reorderMembers(
          groups
            .filter((group) => group.changed)
            .map((group) => ({
              departmentId: group.departmentId,
              memberIds: group.members.map((member) => member.id),
            })),
        ),
        () => {
          message.success("Порядок сотрудников сохранён");
          router.refresh();
          close();
        },
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="Изменить порядок сотрудников"
      width={720}
      onCancel={() => {
        if (!saving) close();
      }}
      onOk={save}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={saving}
      okButtonProps={{ disabled: !groups.some((group) => group.changed) }}
      cancelButtonProps={{ disabled: saving }}
      closable={!saving}
      keyboard={!saving}
      mask={{ closable: false }}
      styles={{ body: { maxHeight: "65dvh", overflowY: "auto" } }}
    >
      <p className="mb-4 text-gray-500">
        Меняйте порядок стрелками внутри подразделения. Изменения появятся на
        странице команды после сохранения.
      </p>
      {groups.map((group, groupIndex) => (
        <section key={group.departmentId ?? "unassigned"} className="mb-6">
          <h3 className="mb-2 font-semibold">{group.name}</h3>
          {group.members.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Нет сотрудников"
            />
          ) : (
            <ol className="m-0 list-none p-0" aria-label={group.name}>
              {group.members.map((member, index) => {
                const name = [
                  member.lastName,
                  member.firstName,
                  member.middleName,
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <li
                    key={member.id}
                    className="flex items-center gap-2 border-b border-gray-200 py-2"
                  >
                    <span className="w-7 shrink-0 text-gray-500">
                      {index + 1}.
                    </span>
                    <span className="min-w-0 flex-1 break-words">{name}</span>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="large"
                        icon={<ArrowUpOutlined />}
                        aria-label={`Переместить вверх: ${name}`}
                        disabled={saving || index === 0}
                        onClick={() => move(groupIndex, index, -1)}
                      />
                      <Button
                        size="large"
                        icon={<ArrowDownOutlined />}
                        aria-label={`Переместить вниз: ${name}`}
                        disabled={saving || index === group.members.length - 1}
                        onClick={() => move(groupIndex, index, 1)}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ))}
    </Modal>
  );
}
