"use client";

import { PlusOutlined } from "@ant-design/icons";
import { FloatButton } from "antd";
import { useCallback, useState } from "react";
import { MemberEditModal } from "./member-edit-modal";
import { MembersTable } from "./members-table";
import type { MemberWithRelations, MembersClientProps } from "./types";

export default function MembersClient({
  members = [],
  departments = [],
  disciplines = [],
  scientificWorks = [],
}: MembersClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [member, setMember] = useState<MemberWithRelations>();

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setMember(undefined);
  }, []);

  const openCreateModal = useCallback(() => {
    setMember(undefined);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((selectedMember: MemberWithRelations) => {
    setMember(selectedMember);
    setModalOpen(true);
  }, []);

  return (
    <>
      <MemberEditModal
        member={member}
        departments={departments}
        disciplines={disciplines}
        scientificWorks={scientificWorks}
        open={modalOpen}
        close={closeModal}
      />
      <MembersTable
        members={members}
        departments={departments}
        onEdit={openEditModal}
      />
      <FloatButton
        icon={<PlusOutlined />}
        type="primary"
        onClick={openCreateModal}
      />
    </>
  );
}
