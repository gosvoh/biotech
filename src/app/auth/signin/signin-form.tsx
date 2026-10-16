"use client";

import { useActionState } from "react";
import { Alert, Button, ConfigProvider, Input } from "antd";
import ruRU from "antd/locale/ru_RU";
import { requestSignIn } from "./actions";

export default function SigninForm({ submitted = false, failed = false }: { submitted?: boolean; failed?: boolean }) {
  const [state, action, pending] = useActionState(requestSignIn, { submitted });
  return (
    <ConfigProvider locale={ruRU}>
      <form action={action} className="flex flex-col gap-5">
        {state.submitted ? (
          <div role="status"><Alert type="info" showIcon title="Если для этого адреса открыт доступ, письмо со ссылкой для входа будет отправлено. Проверьте почту, включая папку «Спам»." /></div>
        ) : failed ? (
          <Alert type="warning" showIcon title="Не удалось войти. Запросите новую ссылку или обратитесь к администратору." />
        ) : null}
        <div>
          <label htmlFor="signin-email" className="mb-2 block">Электронная почта</label>
          <Input id="signin-email" name="email" type="email" autoComplete="email" required maxLength={254} size="large" />
        </div>
        <Button type="primary" htmlType="submit" loading={pending} disabled={pending} size="large">Получить ссылку для входа</Button>
        <p className="text-sm text-gray-600">Вход доступен только пользователям, которым администратор предоставил доступ.</p>
      </form>
    </ConfigProvider>
  );
}
