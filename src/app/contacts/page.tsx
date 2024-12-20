"use client";

import Link from "next/link";
import Breadcrumbs from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { Form } from "antd";
// import dynamic from "next/dynamic";

// const YandexMap = dynamic(async () => import("@/components/yandex.map"), {});

const AskQuestion = ({ className }: { className?: string }) => {
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!successModalOpen) return;
    const timeout = setTimeout(() => {
      setSuccessModalOpen(false);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [successModalOpen]);

  return (
    <div className={cn("space-y-4 md:space-y-6", className)}>
      <p className="font-bold text-xl xl:text-2xl text-accent-carbon">
        Задать вопрос декану
      </p>
      <Dialog open={formModalOpen} onOpenChange={setFormModalOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary">Задать вопрос</Button>
        </DialogTrigger>
        <DialogContent className="max-md:max-w-11/12">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center">
              Задать вопрос декану
            </DialogTitle>
          </DialogHeader>
          <Form form={form} onFinish={console.log}>
            <Form.Item
              name="name"
              rules={[
                { required: true, message: "Пожалуйста, введите ваше ФИО" },
              ]}
            >
              <input className="form-input" type="text" placeholder="ФИО" />
            </Form.Item>
            <Form.Item
              name="Email"
              rules={[
                { type: "email", message: "Некорректный email" },
                { required: true, message: "Пожалуйста, введите ваш email" },
              ]}
            >
              <input className="form-input" type="email" placeholder="Email" />
            </Form.Item>
            <Form.Item
              name="question"
              rules={[
                { required: true, message: "Пожалуйста, введите ваш вопрос" },
              ]}
            >
              <textarea
                className="form-input resize-none"
                placeholder="Ваш вопрос"
                rows={6}
              />
            </Form.Item>
          </Form>
          <DialogFooter>
            <Button
              onClick={() => {
                setFormModalOpen(false);
                setSuccessModalOpen(true);
              }}
            >
              Закрыть
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
            <DialogTitle className="text-2xl text-center">
              Спасибо за ваш вопрос!
            </DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function ContactsPage() {
  return (
    <main>
      <section>
        <Breadcrumbs
          items={[{ title: "Главная", href: "/" }, { title: "Контакты" }]}
        />
        <div className="wrapper md:flex-row md:gap-6">
          <div className="md:max-w-5/8 w-full">
            <h1 className="md:mb-6 xl:mb-10">Контакты</h1>
            <AskQuestion className="md:hidden mt-10 mb-6" />
            <div className="flex flex-col gap-4 xl:gap-6 text-lg">
              <p className="font-bold text-xl md:text-2xl xl:text-3xl mb-2">
                Факультет биотехнологий
              </p>
              <div className="space-y-2">
                <p className="text-2xl xl:text-3xl">191002</p>
                <p className="text-sm xl:text-lg">
                  Санкт-Петербург, ул. Ломоносова, д. 9
                </p>
              </div>
              <div className="space-y-2">
                <Link
                  className="block text-2xl xl:text-3xl w-fit link-hover-underline-compact"
                  href="mailto:biotech@itmo.ru"
                >
                  biotech@itmo.ru
                </Link>
                <Link
                  href="tel:+78124800930"
                  className="block text-sm xl:text-lg w-fit link-hover-underline-compact"
                >
                  +7 (812) 480-09-30 (отдел развития)
                </Link>
                <Link
                  href="tel:+9312789700"
                  className="block text-sm xl:text-lg w-fit link-hover-underline-compact"
                >
                  +7 (931) 278-97-00 (декан)
                </Link>
              </div>
            </div>
          </div>
          <AskQuestion className="max-md:hidden" />
        </div>
      </section>

      {/* <YandexMap className="w-full aspect-square max-h-[600px] mt-16" /> */}
    </main>
  );
}
