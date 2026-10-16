"use client";

import { Alert, Button, Checkbox, Form, Input, Modal, Radio, Space, Typography } from "antd";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_ACCESS_BUNDLES, ADMIN_SECTIONS, type AdminAccess, type AdminSection } from "@/lib/admin-access";
import { createUser, sendUserInvitation, updateUserAccess } from "./actions";
import type { AdminUserView } from "./types";

type Props = { user?: AdminUserView; open: boolean; onClose: () => void; isSelf?: boolean };

// A fresh component owns every opening and every target, as in MemberEditModal.
export function UserAccessModal(props: Props) {
  return props.open ? <AccessForm key={props.user?.id ?? "new"} {...props} /> : null;
}

function AccessForm({ user, onClose, isSelf }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(user);
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<AdminAccess["role"]>(user?.role ?? "user");
  const [sections, setSections] = useState<AdminSection[]>(user?.sections ?? []);
  const [pending, setPending] = useState<"save" | "invite" | null>(null);
  const lock = useRef(false);
  const [error, setError] = useState<{ title: string; description: string }>();
  const [notice, setNotice] = useState("");
  const dirty = !saved || role !== saved.role || [...sections].sort().join() !== [...saved.sections].sort().join();

  async function save() {
    if (lock.current) return;
    if (!saved && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError({ title: "Ошибка сохранения", description: "Укажите корректный email пользователя." }); return;
    }
    lock.current = true; setPending("save"); setError(undefined); setNotice("");
    try {
      const input = { role, sections };
      const result = saved ? await updateUserAccess(saved.id, input) : await createUser({ email, ...input });
      if (!result.ok) { setError({ title: "Ошибка сохранения", description: result.error }); return; }
      setSaved({ id: result.data.userId, email: saved?.email ?? email.trim().toLowerCase(), name: saved?.name ?? null, role: result.data.role, accessStatus: result.data.status, sections: result.data.sections, createdAt: saved?.createdAt ?? new Date().toISOString() });
      setRole(result.data.role); setSections(result.data.sections);
      setNotice("Доступ сохранён. Приглашение можно отправить отдельно."); router.refresh();
    } catch { setError({ title: "Ошибка сохранения", description: "Не удалось сохранить доступ. Повторите действие." }); }
    finally { lock.current = false; setPending(null); }
  }

  async function invite() {
    if (lock.current || !saved || saved.accessStatus !== "active" || dirty || !saved.email) return;
    lock.current = true; setPending("invite"); setError(undefined); setNotice("");
    try {
      const result = await sendUserInvitation(saved.id);
      if (!result.ok) setError({ title: "Ошибка приглашения", description: result.error });
      else setNotice(`Приглашение отправлено на ${saved.email}.`);
    } catch { setError({ title: "Ошибка приглашения", description: "Не удалось отправить приглашение. Повторите позже." }); }
    finally { lock.current = false; setPending(null); }
  }

  return <Modal open centered styles={{ body: { maxHeight: "calc(100dvh - 220px)", overflowY: "auto" } }} title={saved ? "Доступ пользователя" : "Добавить пользователя"} onCancel={onClose} mask={{ closable: false }} closable={!pending} keyboard={!pending} destroyOnHidden footer={<Space wrap>
    <Button disabled={!!pending} onClick={onClose}>Закрыть</Button>
    <Button disabled={!!pending || !saved?.email || saved.accessStatus !== "active" || dirty} loading={pending === "invite"} onClick={invite}>Отправить приглашение</Button>
    <Button type="primary" disabled={!!pending} loading={pending === "save"} onClick={save}>Сохранить</Button>
  </Space>}>
    <Form layout="vertical" onFinish={save}>
      <Form.Item label="Эл. почта" htmlFor="user-access-email" required><Input id="user-access-email" type="email" value={saved?.email ?? email} readOnly={!!saved} disabled={!!pending} onChange={event => setEmail(event.target.value)} autoComplete="off" /></Form.Item>
      {saved && <Typography.Paragraph type="secondary">Email сохранённого пользователя изменить нельзя.</Typography.Paragraph>}
      <Form.Item label="Тип доступа"><Radio.Group value={role} disabled={!!pending} onChange={event => setRole(event.target.value)}>
        <Radio value="user" disabled={isSelf}>Редактор</Radio><Radio value="admin">Администратор</Radio>
      </Radio.Group></Form.Item>
      {isSelf && <Alert type="info" showIcon title="Это ваш аккаунт" description="Нельзя понизить собственную роль, заблокировать или удалить свой аккаунт." className="mb-4" />}
      {role === "admin" && <Typography.Paragraph>Администратор управляет всеми разделами и пользователями.</Typography.Paragraph>}
      <Form.Item label="Готовые наборы"><Space wrap>{Object.entries(ADMIN_ACCESS_BUNDLES).map(([key, bundle]) => <Button key={key} disabled={!!pending || role === "admin"} onClick={() => setSections([...bundle.sections])}>{bundle.label}</Button>)}</Space></Form.Item>
      <Form.Item label="Разделы" extra="Набор можно скорректировать вручную. Право «Новости и теги» включает действия ВК."><Checkbox.Group value={sections} disabled={!!pending || role === "admin"} onChange={values => setSections(values as AdminSection[])}><div className="flex flex-col gap-2">{ADMIN_SECTIONS.map(section => <Checkbox key={section.code} value={section.code}>{section.label}</Checkbox>)}</div></Checkbox.Group></Form.Item>
    </Form>
    <Typography.Paragraph type="secondary">Сохранение не отправляет письмо. Перед приглашением сохраните изменения. Приглашать можно только активного пользователя.</Typography.Paragraph>
    {error && <Alert type="error" showIcon title={error.title} description={error.description} role="alert" />}
    {notice && <Alert type="success" showIcon title={notice} role="status" />}
  </Modal>;
}
