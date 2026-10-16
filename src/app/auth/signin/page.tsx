import type { Metadata } from "next";
import { Suspense } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import SigninForm from "./signin-form";

export const metadata: Metadata = { title: "Вход в управление сайтом", robots: { index: false, follow: false } };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function SigninContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <AntdRegistry><SigninForm submitted={params.type === "email"} failed={!!params.error} /></AntdRegistry>;
}

// Public sibling of /admin: no protected layout or authentication redirect.
export default function SigninPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-24">
      <h1 className="mb-8 text-3xl font-semibold">Вход в управление сайтом</h1>
      <Suspense fallback={<p>Загрузка формы входа…</p>}><SigninContent searchParams={searchParams} /></Suspense>
    </main>
  );
}
