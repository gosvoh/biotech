"use client";

import {
  Button,
  DatePicker,
  FloatButton,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
} from "antd";
import {
  createPublication,
  deletePublication,
  updatePublication,
} from "./actions";
import Link from "next/link";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import type { Publication } from "@/lib/db/client";
import type { getPublications } from "./page";
import dayjs from "@/lib/dayjs";

function EditModal({
  publication,
  open,
  close,
}: {
  publication?: Publication;
  open: boolean;
  close: () => void;
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (publication?.id) {
      form.setFieldsValue({
        ...publication,
        year: dayjs(publication.year),
      });
    } else form.resetFields();

    return () => form.resetFields();
  }, [form, publication]);

  return (
    <Modal
      open={open}
      title={publication ? "Edit publication" : "Create publication"}
      onOk={() => form.submit()}
      onCancel={close}
      destroyOnHidden
    >
      <Form
        preserve={false}
        onFinish={(values) =>
          Promise.all([
            publication
              ? updatePublication({
                  ...values,
                  id: publication.id,
                  year: values.year.year().toString(),
                })
              : createPublication({
                  ...values,
                  year: values.year.year().toString(),
                }),
          ]).then(close)
        }
        form={form}
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
      >
        <Form.Item label="Year" name="year" rules={[{ required: true }]}>
          <DatePicker picker="year" className="w-full" />
        </Form.Item>
        <Form.Item label="Authors" name="authors" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Title" name="title" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="Link"
          name="link"
          rules={[{ required: true, type: "url" }]}
        >
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function ProjectsClient({
  publications,
}: {
  publications: Awaited<ReturnType<typeof getPublications>>;
}) {
  const yearFilter = useMemo(() => {
    const years = publications.map((p) => p.year);
    return years.filter((year, index) => years.indexOf(year) === index);
  }, [publications]);

  const [modalOpen, setModalOpen] = useState(false);
  const [project, setProject] = useState<Publication | undefined>();

  return (
    <>
      <EditModal
        publication={project}
        open={modalOpen}
        close={() => {
          setModalOpen(false);
          setProject(undefined);
        }}
      />
      <Table
        dataSource={publications}
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
            title: "Year",
            dataIndex: "year",
            width: 100,
            filters: yearFilter.map((year) => ({ text: year, value: year })),
            filterMultiple: true,
            onFilter: (value, record) => record.year === value,
          },
          {
            title: "Publication",
            render: (_, record) => (
              <>
                <Link href={record.link} target="_blank">
                  {record.authors}
                </Link>{" "}
                {record.title}
              </>
            ),
          },
          {
            title: "Actions",
            width: 100,
            render: (_, record) => (
              <Space>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => {
                    setProject(record);
                    setModalOpen(true);
                  }}
                />
                <Popconfirm
                  title="Are you sure?"
                  onConfirm={() => deletePublication(record.id)}
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
