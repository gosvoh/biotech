"use client";

import {
  Button,
  FloatButton,
  Form,
  Image,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Upload,
} from "antd";
import type { Department, Member } from "@/lib/db/client";
import {
  addMember,
  deleteMember,
  duplicateMember,
  updateMember,
} from "./actions";
import { useState } from "react";
import {
  ArrowLeftOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import Link from "next/link";

function EditModal({
  member,
  departments,
  open,
  close,
}: {
  member?: Member;
  departments: Department[];
  open: boolean;
  close: () => void;
}) {
  const [form] = Form.useForm();

  return (
    <Modal
      open={open}
      title={member ? "Edit Member" : "Add Member"}
      onOk={() => form.submit()}
      onCancel={close}
      destroyOnClose
    >
      <Form
        preserve={false}
        onFinish={(values) => {
          const fd = new FormData();
          if (member) fd.append("id", member.id);
          for (const key in values) {
            if (!values[key]) continue;
            if (key === "image") {
              const file = values[key][0]?.originFileObj;
              if (file) fd.append(key, file);
            } else fd.append(key, values[key]);
          }
          if (member) {
            updateMember(fd).then(close);
          } else {
            addMember(fd).then(close);
          }
        }}
        form={form}
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        initialValues={{
          lastName: member?.lastName,
          firstName: member?.firstName,
          middleName: member?.middleName,
          position: member?.position,
          email: member?.email,
          phone: member?.phone,
          departmentId: member?.departmentId ?? departments[0]?.id,
        }}
      >
        <Form.Item
          label="Last Name"
          name="lastName"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="First Name"
          name="firstName"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item label="Middle Name" name="middleName">
          <Input />
        </Form.Item>
        <Form.Item label="Position" name="position">
          <Input />
        </Form.Item>
        <Form.Item label="Email" name="email">
          <Input />
        </Form.Item>
        <Form.Item label="Phone" name="phone">
          <Input />
        </Form.Item>
        <Form.Item label="Department" name="departmentId">
          <Select
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
          />
        </Form.Item>
        <Form.Item
          label="Image"
          name="image"
          valuePropName="fileList"
          getValueFromEvent={(e) => e.fileList}
          rules={[{ required: !member }]}
        >
          <Upload
            listType="picture"
            beforeUpload={() => false}
            maxCount={1}
            accept="image/*"
          >
            <Button icon={<UploadOutlined />}>Upload</Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function MembersClient({
  members = [],
  departments = [],
}: {
  members: Member[];
  departments: Department[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [member, setMember] = useState<Member>();

  return (
    <>
      <EditModal
        member={member}
        departments={departments}
        open={modalOpen}
        close={() => {
          setModalOpen(false);
          setMember(undefined);
        }}
      />
      <Table
        dataSource={members}
        rowKey={"id"}
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
            dataIndex: "id",
            width: 100,
            render: (id, record) => (
              <Image
                width={100}
                height={100}
                src={`/uploads/members/${id}.webp`}
                className="object-cover rounded-full"
                alt={[
                  record.firstName,
                  record.middleName,
                  record.lastName,
                ].join(" ")}
                placeholder
              />
            ),
          },
          {
            title: "Name",
            render: (_, record) =>
              `${record.lastName} ${record.firstName} ${
                record.middleName ?? ""
              }`.trim(),
          },
          {
            title: "Department",
            width: 200,
            render: (_, record) =>
              departments.find((d) => d.id === record.departmentId)?.name,
          },
          {
            title: "Position",
            dataIndex: "position",
            width: 200,
          },
          {
            title: "Email",
            dataIndex: "email",
            width: 200,
          },
          {
            title: "Phone",
            dataIndex: "phone",
            width: 200,
          },
          {
            title: "Actions",
            width: 100,
            render: (_, record) => (
              <Space>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => {
                    setMember(() => record);
                    setModalOpen(true);
                  }}
                />
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => duplicateMember(record.id)}
                />
                <Popconfirm
                  title="Are you sure?"
                  onConfirm={() => deleteMember(record.id)}
                >
                  <Button danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <FloatButton
        icon={<PlusOutlined />}
        type="primary"
        onClick={() => setModalOpen(true)}
      />
    </>
  );
}
