"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Button, FloatButton } from "antd";
import { useCallback, useState } from "react";
import { MemberEditModal } from "./member-edit-modal";
import { MembersTable } from "./members-table";
import { MemberOrderModal } from "./member-order-modal";
import type { MemberWithRelations, MembersClientProps } from "./types";

export default function MembersClient({
  members = [],
  departments = [],
  disciplines = [],
  scientificWorks = [],
}: MembersClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
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
      <div className="my-4">
        <Button onClick={() => setOrderOpen(true)} disabled={members.length === 0}>
          Изменить порядок
        </Button>
      </div>
      {orderOpen && (
        <MemberOrderModal members={members} departments={departments} close={() => setOrderOpen(false)} />
      )}
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
