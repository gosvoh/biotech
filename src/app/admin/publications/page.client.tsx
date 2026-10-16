"use client";

import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  FloatButton,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
} from "antd";
import type { DescriptionsProps } from "antd";
import {
  createPublication,
  deletePublication,
  updatePublication,
} from "./actions";
import Link from "next/link";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useMemo, useState } from "react";
import type { Publication } from "@/lib/db/client";
import type { getPublications } from "./page";
import dayjs from "@/lib/dayjs";
import { useAction } from "@/lib/use-action";
import { usePendingAction } from "@/lib/use-pending-action";
import { ResponsiveTable } from "../responsive-table";
import { ListSearch } from "../list-search";

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
  const { run, pending, isPending } = usePendingAction();
  const saving = pending.has("save");

  return (
    <Modal
      open={open}
      title={publication ? "Редактировать публикацию" : "Добавить публикацию"}
      okText="Сохранить"
      cancelText="Отмена"
      onOk={() => { if (!isPending("save")) form.submit(); }}
      onCancel={() => { if (!isPending("save")) close(); }}
      confirmLoading={saving}
      okButtonProps={{ disabled: saving }}
      cancelButtonProps={{ disabled: saving }}
      closable={{ disabled: saving }}
      keyboard={!saving}
      mask={{ closable: !saving }}
      destroyOnHidden
    >
      <Form
        // Remount per publication so `initialValues` are re-applied on each
        // open. Populating via `initialValues` (instead of a useEffect calling
        // setFieldsValue) is immune to Modal mount timing: the <Form> mounts
        // only when the modal opens, and values applied at mount always stick.
        key={publication?.id ?? "new"}
        preserve={false}
        disabled={saving}
        initialValues={{
          authors: publication?.authors,
          title: publication?.title,
          link: publication?.link,
          year: publication ? dayjs(publication.year) : undefined,
        }}
        onFinish={(values) =>
          run("save",
            () => publication
              ? updatePublication({
                  ...values,
                  id: publication.id,
                  year: values.year.year().toString(),
                })
              : createPublication({
                  ...values,
                  year: values.year.year().toString(),
                }),
            close
          )
        }
        form={form}
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
      >
        <Form.Item label="Год" name="year" rules={[{ required: true }]}>
          <DatePicker picker="year" className="w-full" />
        </Form.Item>
        <Form.Item label="Авторы" name="authors" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Название" name="title" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="Ссылка"
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
  const runAction = useAction();

  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase("ru");
  const filtered = publications.filter(record => [record.title, record.authors, record.year].join(" ").toLocaleLowerCase("ru").includes(search));

  const renderPublicationCard = (record: Publication) => {
    const items: DescriptionsProps["items"] = [
      { key: "year", label: "Год", children: record.year },
      { key: "authors", label: "Авторы", children: record.authors },
      {
        key: "link",
        label: "Ссылка",
        children: (
          <Link href={record.link} target="_blank">
            Открыть
          </Link>
        ),
      },
    ];

    return (
      <Card size="small">
        <div className="font-semibold">{record.title}</div>
        <Descriptions column={1} size="small" className="mt-2" items={items} />
        <div className="mt-3 flex justify-end gap-2">
          <Button
            icon={<EditOutlined />}
            aria-label={`Редактировать: ${record.title}`}
            title="Редактировать"
            onClick={() => {
              setProject(record);
              setModalOpen(true);
            }}
          />
          <Popconfirm
            title={`Удалить публикацию «${record.title}»?`}
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => runAction(deletePublication(record.id))}
          >
            <Button danger icon={<DeleteOutlined />} aria-label={`Удалить: ${record.title}`} title="Удалить" />
          </Popconfirm>
        </div>
      </Card>
    );
  };

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
      <ListSearch value={query} onChange={setQuery} foundCount={filtered.length} placeholder="Поиск по названию, авторам или году публикации" />
      <div hidden={filtered.length === 0}>
      <ResponsiveTable
        dataSource={filtered}
        resetKey={search}
        rowKey="id"
        pagination={{ pageSize: 30, hideOnSinglePage: true }}
        columns={[
          {
            title: "Год",
            dataIndex: "year",
            width: 100,
            filters: yearFilter.map((year) => ({ text: year, value: year })),
            filterMultiple: true,
            onFilter: (value, record) => record.year === value,
          },
          {
            title: "Публикация",
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
            title: "Действия",
            width: 100,
            render: (_, record) => (
              <Space>
                <Button
                  icon={<EditOutlined />}
                  aria-label={`Редактировать: ${record.title}`}
                  title="Редактировать"
                  onClick={() => {
                    setProject(record);
                    setModalOpen(true);
                  }}
                />
                <Popconfirm
                  title={`Удалить публикацию «${record.title}»?`}
                  okText="Удалить"
                  cancelText="Отмена"
                  onConfirm={() => runAction(deletePublication(record.id))}
                >
                  <Button danger icon={<DeleteOutlined />} aria-label={`Удалить: ${record.title}`} title="Удалить" />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        renderCard={renderPublicationCard}
      />
      </div>
      <FloatButton
        icon={<PlusOutlined />}
        type="primary"
        onClick={() => setModalOpen(true)}
      />
    </>
  );
}
