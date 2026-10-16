"use client";

import { Alert, Button, Card, Popconfirm, Select, Space, Tag, Typography } from "antd";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_SECTIONS } from "@/lib/admin-access";
import { ResponsiveTable } from "../responsive-table";
import { ListSearch } from "../list-search";
import { deleteUser, setUserBlocked } from "./actions";
import { UserAccessModal } from "./user-access-modal";
import { USER_STATUS_LABELS, userTypeLabel, type AdminUserView } from "./types";

const STATUS_ACTIONS = {
  pending: {
    label: "Предоставить доступ",
    confirmation: "Предоставить доступ пользователю?",
    notice: "Доступ пользователю предоставлен. Приглашение можно отправить отдельно.",
  },
  active: {
    label: "Заблокировать",
    confirmation: "Заблокировать пользователя?",
    notice: "Пользователь заблокирован. Сессии и ссылки отозваны.",
  },
  blocked: {
    label: "Разблокировать",
    confirmation: "Разблокировать пользователя?",
    notice: "Пользователь разблокирован. Для входа понадобится новая ссылка.",
  },
};

export default function UsersClient({ userId, users = [] }: { userId?: string; users: AdminUserView[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [editing, setEditing] = useState<AdminUserView | "new" | null>(null);
  const [pending, setPending] = useState<string>();
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const search = query.trim().toLocaleLowerCase("ru");
  const filtered = users.filter(user =>
    (!search || `${user.name ?? ""} ${user.email ?? ""}`.toLocaleLowerCase("ru").includes(search)) &&
    (status === "all" || user.accessStatus === status) &&
    (type === "all" || (type === "admin" ? user.role === "admin" : user.role !== "admin" && (type === "editor" ? user.sections.length > 0 : user.sections.length === 0))),
  );
  async function mutate(user: AdminUserView, operation: "delete" | "block") {
    if (lock.current) return;
    lock.current = true; setPending(user.id); setError(""); setNotice("");
    try {
      const result = operation === "delete" ? await deleteUser(user.id) : await setUserBlocked(user.id, user.accessStatus === "active");
      if (!result.ok) setError(result.error);
      else { setNotice(operation === "delete" ? "Пользователь удалён." : STATUS_ACTIONS[user.accessStatus].notice); router.refresh(); }
    } catch { setError("Не удалось выполнить действие. Повторите позже."); }
    finally { lock.current = false; setPending(undefined); }
  }
  const statusTag = (user: AdminUserView) => <Tag color={user.accessStatus === "active" ? "success" : user.accessStatus === "blocked" ? "error" : "default"}>{USER_STATUS_LABELS[user.accessStatus]}</Tag>;
  const sections = (user: AdminUserView) => user.role === "admin" ? "Все разделы" : ADMIN_SECTIONS.filter(section => user.sections.includes(section.code)).map(section => section.label).join(", ") || "Нет доступа к разделам";
  const identity = (user: AdminUserView) => [user.name, user.email].filter(Boolean).join(" · ") || `Пользователь ${user.id}`;
  const actions = (user: AdminUserView) => <Space wrap>
    <Button disabled={!!pending} onClick={() => setEditing(user)}>Настроить доступ</Button>
    <Popconfirm title={STATUS_ACTIONS[user.accessStatus].confirmation} description={identity(user)} okText="Подтвердить" cancelText="Отмена" onConfirm={() => mutate(user, "block")} disabled={user.id === userId || !!pending}>
      <Button disabled={user.id === userId || !!pending} loading={pending === user.id}>{STATUS_ACTIONS[user.accessStatus].label}</Button>
    </Popconfirm>
    <Popconfirm title="Удалить пользователя?" description={<>{identity(user)}<p>Аккаунт будет удалён. Доступ, сессии и ссылки для входа будут отозваны.</p></>} okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }} onConfirm={() => mutate(user, "delete")} disabled={user.id === userId || !!pending}>
      <Button danger disabled={user.id === userId || !!pending}>Удалить</Button>
    </Popconfirm>
  </Space>;
  return <div className="flex flex-col gap-4">
    <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
      <ListSearch value={query} onChange={setQuery} foundCount={filtered.length} placeholder="Поиск по имени или email" />
      <label className="flex flex-col gap-1">Статус доступа<Select aria-label="Статус доступа" value={status} onChange={setStatus} className="min-w-44" options={[{ value: "all", label: "Все статусы" }, ...Object.entries(USER_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} /></label>
      <label className="flex flex-col gap-1">Тип доступа<Select aria-label="Тип доступа" value={type} onChange={setType} className="min-w-44" options={[{ value: "all", label: "Все типы" }, { value: "admin", label: "Администратор" }, { value: "editor", label: "Редактор" }, { value: "none", label: "Без разделов" }]} /></label>
      <Button type="primary" disabled={!!pending} onClick={() => setEditing("new")}>Добавить пользователя</Button>
    </div>
    {error && <Alert type="error" title={error} showIcon role="alert" />}
    {notice && <Alert type="success" title={notice} showIcon role="status" />}
    {filtered.length > 0 && <ResponsiveTable<AdminUserView> resetKey={JSON.stringify([search, status, type])} dataSource={filtered} rowKey="id" pagination={{ pageSize: 30 }} renderCard={user => <Card size="small">
      <div className="font-semibold break-all">{user.name || user.email || "Без имени"}</div>
      {user.name && <div className="break-all">{user.email || "Email не указан"}</div>}
      <div className="my-2 flex flex-wrap gap-1">{statusTag(user)}<Tag>{userTypeLabel(user)}</Tag></div>
      <p className="mb-3">{sections(user)}</p>
      {user.id === userId && <p className="mb-3 text-sm">Это ваш аккаунт. Понижение роли, блокировка и удаление недоступны.</p>}
      {actions(user)}
    </Card>} columns={[
      { title: "Пользователь", render: (_, user) => <div className="break-all"><div>{user.name}</div><div>{user.email || "Email не указан"}</div>{user.id === userId && <Typography.Text type="secondary">Ваш аккаунт: нельзя понизить роль, заблокировать или удалить.</Typography.Text>}</div> },
      { title: "Статус", render: (_, user) => statusTag(user) },
      { title: "Тип доступа", render: (_, user) => userTypeLabel(user) },
      { title: "Разделы", render: (_, user) => sections(user) },
      { title: "Действия", width: 330, render: (_, user) => actions(user) },
    ]} />}
    <UserAccessModal open={editing !== null} user={editing && editing !== "new" ? editing : undefined} isSelf={!!editing && editing !== "new" && editing.id === userId} onClose={() => setEditing(null)} />
  </div>;
}
