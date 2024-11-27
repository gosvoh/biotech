"use client";

import type { News, NewsTags } from "@/lib/db/client";
import { ArrowLeftOutlined, UploadOutlined } from "@ant-design/icons";
import MarkdownEditor from "@uiw/react-md-editor/nohighlight";
import {
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  Select,
  Upload,
} from "antd";
import Link from "next/link";
import { addNews, updateNews } from "./actions";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

import dayjs from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { rehypeRewrite } from "@/components/markdown-render";

export default function NewsClient({
  news,
  tags,
}: {
  news?: News & { tags: NewsTags[] };
  tags: NewsTags[];
}) {
  const {
    vkLink,
    tgLink,
  }: {
    vkLink?: string;
    tgLink?: string;
  } = JSON.parse(news?.links || "{}");

  const router = useRouter();
  const { pending } = useFormStatus();

  return (
    <main>
      <section>
        <div className="wrapper">
          <Link href="/admin/news">
            <Button icon={<ArrowLeftOutlined />} type="primary">
              Back
            </Button>
          </Link>
          <Form
            onFinish={(values) => {
              const fd = new FormData();
              if (news?.id) fd.append("id", news.id);
              for (const key in values) {
                if (!values[key] || ["vkLink", "tgLink"].includes(key))
                  continue;
                if (key === "image") {
                  const file = values[key][0]?.originFileObj;
                  if (file) fd.append(key, file);
                } else fd.append(key, values[key]);
              }
              fd.append(
                "links",
                JSON.stringify({
                  vkLink: values.vkLink,
                  tgLink: values.tgLink,
                })
              );

              if (news) updateNews(fd);
              else
                addNews(fd).then((x) =>
                  router.push(`/admin/news/${(x as { id: string }).id}`)
                );
            }}
            layout="vertical"
            initialValues={{
              title: news?.title,
              tags: news?.tags.map((x) => x.id),
              vkLink,
              tgLink,
              text: news?.text,
              date: dayjs(news?.date),
              hidden: news?.hidden,
            }}
          >
            <Form.Item name="title" label="Title" rules={[{ required: true }]}>
              <Input allowClear />
            </Form.Item>
            <Form.Item name="tags" label="Tags" rules={[{ required: true }]}>
              <Select
                mode="multiple"
                options={tags.map((x) => ({ label: x.title, value: x.id }))}
                maxTagTextLength={30}
                maxCount={15}
              />
            </Form.Item>
            <Form.Item
              name="vkLink"
              label="VK Link"
              dependencies={["tgLink"]}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value && !getFieldValue("tgLink")) {
                      return Promise.reject(
                        new Error("At least one link is required")
                      );
                    }

                    return Promise.resolve();
                  },
                }),
                { type: "url" },
              ]}
            >
              <Input allowClear />
            </Form.Item>
            <Form.Item
              name="tgLink"
              label="Telegram Link"
              dependencies={["vkLink"]}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value && !getFieldValue("vkLink")) {
                      return Promise.reject(
                        new Error("At least one link is required")
                      );
                    }

                    return Promise.resolve();
                  },
                }),
                { type: "url" },
              ]}
            >
              <Input allowClear />
            </Form.Item>
            <Form.Item name="date" label="Date" rules={[{ required: true }]}>
              <DatePicker format="LL" className="w-full" />
            </Form.Item>
            <Form.Item name="hidden" label="Hidden" valuePropName="checked">
              <Checkbox />
            </Form.Item>
            <Form.Item
              label="Image"
              name="image"
              valuePropName="fileList"
              getValueFromEvent={(e) => e.fileList}
              rules={[{ required: !news }]}
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
            <Form.Item
              name="text"
              labelCol={{ span: 0 }}
              wrapperCol={{ span: 24 }}
              rules={[{ required: true }]}
            >
              <MarkdownEditor
                height={400}
                previewOptions={{
                  rehypeRewrite,
                  className: cn(
                    "!text-base md:!text-lg",
                    "[&>h3]:!text-lg [&>h3]:md:!text-xl"
                  ),
                }}
                commandsFilter={(command) => {
                  if (
                    ["hr", "divider", "table", "codeBlock", "code"].includes(
                      command.keyCommand ?? ""
                    )
                  )
                    return false;

                  if (command.name === "title") {
                    const title3 = (command.children as (typeof command)[])[2];

                    const newTitleCommand: typeof command = {
                      buttonProps: command.buttonProps,
                      keyCommand: command.name,
                      name: command.name,
                      icon: command.icon,
                      execute: title3.execute,
                      prefix: title3.prefix,
                      suffix: title3.suffix,
                    };
                    return newTitleCommand;
                  }
                  return command;
                }}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={pending}>
              Submit
            </Button>
          </Form>
        </div>
      </section>
    </main>
  );
}
