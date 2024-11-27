"use client";

import type { News, NewsTags } from "@/lib/db/client";
import {
  ArrowLeftOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Button,
  Checkbox,
  FloatButton,
  Image,
  Popconfirm,
  Space,
  Table,
  Tag,
} from "antd";
import Link from "next/link";
import { changeVisibility, deleteNews, duplicateNews } from "./actions";

export default function NewsClient({
  news,
}: {
  news: (Omit<News, "text"> & { tags: NewsTags[] })[];
}) {
  return (
    <>
      <Table
        dataSource={news}
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
            dataIndex: "id",
            width: 100,
            render: (id, record) => (
              <Image
                width={100}
                height={100}
                src={`/uploads/news/${id}.webp`}
                className="object-cover rounded-lg"
                alt={record.title}
              />
            ),
          },
          {
            title: "Title",
            dataIndex: "title",
            width: 200,
          },
          {
            title: "Tags",
            width: 200,
            render: (_, record) => (
              <Space direction="vertical">
                {record.tags.map((x) => (
                  <Tag key={`tag-${record.id}-${x.id}`}>{x.title}</Tag>
                ))}
              </Space>
            ),
          },
          {
            title: "Hidden",
            width: 100,

            render: (_, record) => (
              <Checkbox
                checked={record.hidden}
                onChange={(v) => changeVisibility(record.id, v.target.checked)}
              />
            ),
          },
          {
            title: "Actions",
            width: 100,
            render: (_, record) => (
              <Space>
                <Link href={`/admin/news/${record.id}`}>
                  <Button icon={<EditOutlined />} />
                </Link>
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => duplicateNews(record.id)}
                />
                <Popconfirm
                  title="Are you sure?"
                  onConfirm={() => deleteNews(record.id)}
                >
                  <Button danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Link href="/admin/news/new" className="contents">
        <FloatButton icon={<PlusOutlined />} type="primary" />
      </Link>
    </>
  );
}
