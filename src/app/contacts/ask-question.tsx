"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ConfigProvider, Form, Input } from "antd";
import { useEffect, useState } from "react";
import { sendMail } from "./actions";

export default function AskQuestion({ className }: { className?: string }) {
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!successModalOpen) return;
    const timeout = setTimeout(() => {
      setSuccessModalOpen(false);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [successModalOpen]);

  return (
    <div className={cn("space-y-4 md:space-y-6", className)}>
      <p className="font-bold text-m_xl md:text-t_xl xl:text-s_xl">
        Задать вопрос декану
      </p>
      <Dialog
        open={formModalOpen}
        onOpenChange={(open) => (sending ? undefined : setFormModalOpen(open))}
      >
        <DialogTrigger asChild>
          <Button variant="outline">Задать вопрос</Button>
        </DialogTrigger>
        <DialogContent className="max-md:max-w-11/12">
          <DialogHeader>
            <DialogTitle asChild className="text-center">
              <h3>Задать вопрос декану</h3>
            </DialogTitle>
          </DialogHeader>
          <ConfigProvider
            theme={{
              token: { colorPrimary: "hsl(270 100% 50%)" },
            }}
          >
            <Form
              form={form}
              onFinish={(values) => {
                setSending(true);
                sendMail(values)
                  .then((isSent) => {
                    if (!isSent) return;
                    form.resetFields();
                    setFormModalOpen(false);
                    setSuccessModalOpen(true);
                  })
                  .finally(() => setSending(false));
              }}
            >
              <Form.Item
                name="name"
                rules={[
                  { required: true, message: "Пожалуйста, введите ваше ФИО" },
                ]}
              >
                <Input placeholder="ФИО" />
              </Form.Item>
              <Form.Item
                name="Email"
                rules={[
                  { type: "email", message: "Некорректный email" },
                  { required: true, message: "Пожалуйста, введите ваш email" },
                ]}
              >
                <Input placeholder="Email" type="email" />
              </Form.Item>
              <Form.Item
                name="question"
                rules={[
                  { required: true, message: "Пожалуйста, введите ваш вопрос" },
                ]}
              >
                <Input.TextArea
                  placeholder="Ваш вопрос"
                  rows={6}
                  className="!resize-none"
                />
              </Form.Item>
            </Form>
          </ConfigProvider>
          <DialogFooter>
            <Button
              disabled={sending}
              onClick={() => {
                form.submit();
              }}
            >
              Задать вопрос
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent
          showClose={false}
          className="max-md:max-w-11/12 rounded-full border border-black yellow-gradient p-10"
        >
          <DialogHeader>
            <DialogTitle className="text-center" asChild>
              <h3>Спасибо за ваш вопрос!</h3>
            </DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
