"use client";

import type { News, NewsTags, NewsImages } from "@/lib/db/client";
import { UploadOutlined } from "@ant-design/icons";
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
import { addNews, updateNews } from "./actions";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useAction } from "@/lib/use-action";

import dayjs from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { rehypeRewrite } from "@/components/markdown-render";

function parseNewsLinks(links?: string | null): {
  vkLink?: string;
  tgLink?: string;
} {
  if (!links) return {};
  try {
    const parsed = JSON.parse(links);
    if (parsed && typeof parsed === "object") {
      return parsed as { vkLink?: string; tgLink?: string };
    }
  } catch {
    // Malformed/legacy value — fall through to empty links.
  }
  return {};
}

export default function NewsClient({
  news,
  tags,
}: {
  news?: News & { tags: NewsTags[]; images: NewsImages[] };
  tags: NewsTags[];
}) {
  // Parse defensively: legacy or hand-edited rows may hold a non-JSON `links`
  // value, and an unguarded JSON.parse here would crash the whole edit page.
  const { vkLink, tgLink } = parseNewsLinks(news?.links);

  const router = useRouter();
  const runAction = useAction();
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Form
        preserve={false}
        onFinish={(values) => {
          const fd = new FormData();
          if (news?.id) fd.append("id", news.id);
          for (const key in values) {
            if (!values[key] || ["vkLink", "tgLink"].includes(key))
              continue;
            if (key === "images") {
              for (const image of values.images) {
                if (image.originFileObj)
                  fd.append("images", image.originFileObj);
                else fd.append("images", image.uid);
              }
            } else fd.append(key, values[key]);
          }
          fd.append(
            "links",
            JSON.stringify({
              vkLink: values.vkLink,
              tgLink: values.tgLink,
            })
          );

          startTransition(async () => {
            if (news)
              await runAction(updateNews(fd), () =>
                window.location.reload()
              );
            else
              await runAction(addNews(fd), (x) =>
                router.push(`/admin/news/${x.id}`)
              );
          });
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
          images: news?.images.map((x) => ({
            uid: x.id,
            name: x.id,
            status: "done",
            url: `/uploads/news/${x.id}.webp`,
          })),
        }}
      >
        <Form.Item name="title" label="Название" rules={[{ required: true }]}>
          <Input allowClear />
        </Form.Item>
        <Form.Item name="tags" label="Теги" rules={[{ required: true }]}>
          <Select
            mode="multiple"
            options={tags.map((x) => ({ label: x.title, value: x.id }))}
            maxTagTextLength={30}
            maxCount={15}
            filterOption={(input, option) =>
              option?.label.toLowerCase().includes(input.toLowerCase()) ??
              false
            }
          />
        </Form.Item>
        <Form.Item
          name="vkLink"
          label="Ссылка VK"
          dependencies={["tgLink"]}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value && !getFieldValue("tgLink")) {
                  return Promise.reject(
                    new Error("Нужна хотя бы одна ссылка")
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
          label="Ссылка Telegram"
          dependencies={["vkLink"]}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value && !getFieldValue("vkLink")) {
                  return Promise.reject(
                    new Error("Нужна хотя бы одна ссылка")
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
        <Form.Item name="date" label="Дата" rules={[{ required: true }]}>
          <DatePicker format="LL" className="w-full" />
        </Form.Item>
        <Form.Item name="hidden" label="Скрыта" valuePropName="checked">
          <Checkbox />
        </Form.Item>
        <Form.Item
          label="Изображения"
          name="images"
          valuePropName="fileList"
          getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          rules={[{ required: !news }]}
        >
          <Upload
            multiple
            listType="picture-card"
            beforeUpload={() => false}
            accept="image/*"
            previewFile={(file) =>
              new Promise((res) => res(URL.createObjectURL(file)))
            }
          >
            <div className="flex flex-col items-center justify-center">
              <UploadOutlined />
              <div className="mt-2">Загрузить</div>
            </div>
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
          Сохранить
        </Button>
      </Form>
    </>
  );
}
