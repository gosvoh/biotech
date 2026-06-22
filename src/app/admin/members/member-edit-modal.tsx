"use client";

import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Upload,
  type UploadFile,
  type UploadProps,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { addMember, updateMember } from "./actions";
import type { MemberEditModalProps } from "./types";
import { MemberImageCropModal } from "./member-image-crop-modal";
import { useAction } from "@/lib/use-action";

function buildMemberFormData(
  values: Record<string, unknown>,
  memberId?: string,
) {
  const formData = new FormData();
  if (memberId) formData.append("id", memberId);

  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;

    if (key === "image") {
      const imageList = value as UploadFile[];
      const file = imageList[0]?.originFileObj;
      if (file) formData.append(key, file);
      continue;
    }

    if (Array.isArray(value)) {
      formData.append(key, value.join(","));
      continue;
    }

    formData.append(key, String(value));
  }

  return formData;
}

export function MemberEditModal({
  member,
  departments,
  scientificWorks,
  disciplines,
  open,
  close,
}: MemberEditModalProps) {
  const [form] = Form.useForm();
  const runAction = useAction();
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCropSrc, setImageToCropSrc] = useState<string>();
  const [imageToCropName, setImageToCropName] = useState<string>();
  const [imageToCropType, setImageToCropType] = useState<string>();
  const fileList = (Form.useWatch("image", form) ?? []) as UploadFile[];

  const closeCropModal = useCallback(() => {
    if (imageToCropSrc?.startsWith("blob:"))
      URL.revokeObjectURL(imageToCropSrc);
    setCropModalOpen(false);
    setImageToCropSrc(undefined);
    setImageToCropName(undefined);
    setImageToCropType(undefined);
  }, [imageToCropSrc]);

  const handleBeforeUpload: UploadProps["beforeUpload"] = useCallback(
    (file: File) => {
      if (imageToCropSrc?.startsWith("blob:"))
        URL.revokeObjectURL(imageToCropSrc);
      setImageToCropSrc(URL.createObjectURL(file));
      setImageToCropName(file.name);
      setImageToCropType(file.type);
      setCropModalOpen(true);
      return Upload.LIST_IGNORE;
    },
    [imageToCropSrc],
  );

  const handleApplyCroppedFile = useCallback(
    (croppedFile: File) => {
      const nextFileList: UploadFile[] = [
        {
          uid: `member-image-${Date.now()}`,
          name: croppedFile.name,
          status: "done",
          originFileObj: croppedFile as UploadFile["originFileObj"],
        },
      ];

      form.setFieldValue("image", nextFileList);
      closeCropModal();
    },
    [closeCropModal, form],
  );

  const handleRemove: UploadProps["onRemove"] = useCallback(() => {
    form.setFieldValue("image", []);
    return true;
  }, [form]);

  // Only touch the form while the modal is open: with `destroyOnHidden` the
  // <Form> is unmounted when closed, and calling form methods then warns
  // "useForm is not connected to any Form element". Reset on close is handled
  // by `destroyOnHidden` + `preserve={false}`.
  useEffect(() => {
    if (!open) return;
    form.setFieldValue("image", []);

    if (member?.id) {
      form.setFieldsValue({
        lastName: member.lastName,
        firstName: member.firstName,
        middleName: member.middleName,
        position: member.position,
        email: member.email,
        phone: member.phone,
        departmentId: member.departmentId ?? departments[0].id,
        disciplines: member.disciplines.map((d) => d.id) ?? [],
        scientificWorks: member.scientificWorks.map((sw) => sw.id) ?? [],
      });
    } else {
      form.resetFields();
    }
  }, [departments, form, member, open]);

  useEffect(
    () => () => {
      if (imageToCropSrc?.startsWith("blob:"))
        URL.revokeObjectURL(imageToCropSrc);
    },
    [imageToCropSrc],
  );

  return (
    <>
      <Modal
        open={open}
        title={member ? "Edit Member" : "Add Member"}
        onOk={() => form.submit()}
        onCancel={() => {
          closeCropModal();
          close();
        }}
        destroyOnHidden
        mask={{ closable: false }}
      >
        <Form
          preserve={false}
          form={form}
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
          onFinish={(values) => {
            const formData = buildMemberFormData(values, member?.id);
            return runAction(
              member ? updateMember(formData) : addMember(formData),
              close,
            );
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
          <Form.Item
            label="Email"
            name="email"
            rules={[{ type: "email", message: "Invalid email" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Phone"
            name="phone"
            rules={[
              { pattern: /^\+?[0-9 ]+$/, message: "Invalid phone number" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Department" name="departmentId">
            <Select
              options={departments.map((department) => ({
                label: department.name,
                value: department.id,
              }))}
              filterOption={(input, option) =>
                option?.label.toLowerCase().includes(input.toLowerCase()) ??
                false
              }
            />
          </Form.Item>
          <Form.Item label="Disciplines" name="disciplines">
            <Select
              mode="multiple"
              options={disciplines.map((discipline) => ({
                label: discipline.title,
                value: discipline.id,
              }))}
              filterOption={(input, option) =>
                option?.label.toLowerCase().includes(input.toLowerCase()) ??
                false
              }
            />
          </Form.Item>
          <Form.Item label="Scientific Works" name="scientificWorks">
            <Select
              mode="multiple"
              options={scientificWorks.map((scientificWork) => ({
                label: scientificWork.title,
                value: scientificWork.id,
              }))}
              filterOption={(input, option) =>
                option?.label.toLowerCase().includes(input.toLowerCase()) ??
                false
              }
            />
          </Form.Item>
          <Form.Item
            label="Image"
            name="image"
            valuePropName="fileList"
            getValueFromEvent={(event) => event.fileList}
            rules={[{ required: !member }]}
          >
            <Upload
              listType="picture"
              fileList={fileList}
              beforeUpload={handleBeforeUpload}
              onRemove={handleRemove}
              maxCount={1}
              accept="image/*"
            >
              <Button icon={<UploadOutlined />}>Upload</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <MemberImageCropModal
        open={cropModalOpen}
        imageSrc={imageToCropSrc}
        imageName={imageToCropName}
        imageType={imageToCropType}
        onCancel={closeCropModal}
        onApply={handleApplyCroppedFile}
      />
    </>
  );
}
