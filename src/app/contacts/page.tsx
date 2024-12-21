import Link from "next/link";
import Breadcrumbs from "@/components/breadcrumbs";
import { contacts } from "@/lib/links";
import type { Metadata } from "next";
import { generateMeta } from "@/lib/meta";
import AskQuestion from "./ask-question";
// import dynamic from "next/dynamic";

// const YandexMap = dynamic(async () => import("@/components/yandex.map"), {});

export const metadata: Metadata = generateMeta(
  "Биотех ИТМО | Контакты",
  "Контакты факультета биотехнологий университета ИТМО",
  "/contacts"
);

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
                <p className="text-sm xl:text-lg">{contacts.address}</p>
              </div>
              <div className="space-y-2">
                <Link
                  className="block text-2xl xl:text-3xl w-fit link-hover-underline-compact"
                  href={`mailto:${contacts.email}`}
                >
                  {contacts.email}
                </Link>
                <Link
                  href={`tel:${contacts.development}`}
                  className="block text-sm xl:text-lg w-fit link-hover-underline-compact"
                >
                  {`${contacts.development} (отдел развития)`}
                </Link>
                <Link
                  href={`tel:${contacts.dean}`}
                  className="block text-sm xl:text-lg w-fit link-hover-underline-compact"
                >
                  {`${contacts.dean} (декан)`}
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
