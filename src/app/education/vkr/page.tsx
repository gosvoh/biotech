import Breadcrumbs from "@/components/breadcrumbs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "next/link";
import Image from "next/image";
import Lightning from "@public/Lightning.svg";
import type { Metadata } from "next";
import { generateMeta } from "@/lib/meta";
import { IndustrialProjectContent } from "./_components/industrial-project";
import {
  SocialProjectContent,
  ArticleContent,
  BusinessProjectContent,
  ArtProjectContent,
} from "./_components/other-types";
import { FaqContent } from "./_components/faq";

export const metadata: Metadata = generateMeta(
  "Биотех ИТМО | ВКР 2027",
  "Выпускная квалификационная работа (ВКР) на факультете биотехнологий Университета ИТМО, выпускной год 2027",
  "/education/vkr",
);

export default function Vkr() {
  return (
    <main>
      <section>
        <Breadcrumbs
          items={[
            { title: "Главная", href: "/" },
            { title: "Образование", href: "/education" },
            { title: "Виды ВКР" },
          ]}
        />
        <div className="wrapper">
          <h1>ВКР 2027</h1>
        </div>
      </section>

      <section className="space-y-10 lg:space-y-20 relative">
        <Image
          src={Lightning}
          alt=""
          className="absolute top-20 left-0 max-lg:hidden"
          width={280}
        />
        <div className="wrapper">
          <Accordion
            type="multiple"
            className="lg:max-w-3/4 lg:ml-auto lg:mr-0 w-full"
            defaultValue={["1"]}
          >
            <AccordionItem value="1">
              <AccordionTrigger>
                Выпускной год 2027 на факультете биотехнологий ИТМО
              </AccordionTrigger>
              <AccordionContent>
                <p>
                  Выпускная квалификационная работа на факультете биотехнологий
                  ИТМО выполняется в рамках практики «Проектная работа» — выделенного времени в учебном плане, которое полностью
                  посвящено ВКР. Проектная работа выполняется в течение всего
                  второго года обучения
                </p>
                <p>Особенность ВКР на факультете биотехнологий:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    Дедлайны на факультете смещены вперед по отношению к общим
                    дедлайнам в университете ИТМО. Смещение связано с особенностями учебного плана и ранним началом проектной
                    работы (практики) по сравнению с другими подразделениями
                    ИТМО. Проектная работа напрямую связана с{" "}
                    <Link
                      href="https://student.itmo.ru/ru/gia/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline underline-offset-2"
                    >
                      ГИА
                    </Link>
                  </li>
                  <li>
                    Контроль выполнения проектной работы осуществляется
                    централизованно на дисциплине «Проектный семинар». Всего
                    обучающиеся выступают на семинаре четыре раза, постепенно
                    демонстрируя промежуточные результаты выполнения проекта
                  </li>
                  <li>
                    Руководитель ВКР для всех типов назначается факультетом. Если у обучающегося имеется заблаговременная договоренность о совместной работе с преподавателем ИТМО, обучающийся
                    указывает это в форме выбора типа ВКР для дальнейшего
                    согласования факультетом
                  </li>
                  <li>
                    Студенты в рамках выполнения ВКР занимаются вопросами
                    документооборота только в случае прямого поручения от факультета. В иных случаях всю бюрократию, связанную с практикой, факультет берет на себя
                  </li>
                  <li>
                    Проектная работа выполняется в соответствии с рабочей
                    программой практики (РПП), в которой обозначены доступные
                    типы ВКР. Для каждого типа ВКР существует сторона,
                    валидирующая применимость результатов работы в выбранной
                    сфере (например, научное сообщество или индустрия). Все типы
                    ВКР описаны ниже. РПП для выпускного курса 2027 будет
                    опубликована в период летних каникул 2026
                  </li>
                  <li>
                    Выполнение проектной работы любого типа является обязательной
                    составляющей учебного плана
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="2">
              <AccordionTrigger>Индустриальный проект</AccordionTrigger>
              <AccordionContent>
                <IndustrialProjectContent />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="3">
              <AccordionTrigger>Социальный проект</AccordionTrigger>
              <AccordionContent>
                <SocialProjectContent />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="4">
              <AccordionTrigger>Научная статья</AccordionTrigger>
              <AccordionContent>
                <ArticleContent />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="5">
              <AccordionTrigger>Бизнес-проект</AccordionTrigger>
              <AccordionContent>
                <BusinessProjectContent />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="6">
              <AccordionTrigger>Арт-проект</AccordionTrigger>
              <AccordionContent>
                <ArtProjectContent />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="7">
              <AccordionTrigger>Дорожная карта весны 2026</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-5 space-y-2">
                  <li>21 апреля 2026 в 11:30 — онлайн вопрос-ответ</li>
                  <li>
                    ~ 4 мая 2026 — студенты принимают решение о том, ВКР какого
                    типа студенты хотят выполнять
                  </li>
                  <li>
                    ~ 15 мая 2026 — демонстрация витрины индустриальных проектов
                    от факультета
                  </li>
                  <li>
                    ~ 01 июня 2026 — студенты изъявляют факультету своё желание
                    взяться за задание (задания) с витрины индустриальных
                    проектов
                  </li>
                  <li>
                    ~ 20 июня 2026 — распределение на индустриальные проекты с витрины
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="8">
              <AccordionTrigger>Вопрос-ответ</AccordionTrigger>
              <AccordionContent>
                <FaqContent />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Контакты пока скрыты — раздел не нужен
        <div className="wrapper">
          <div className="flex flex-col gap-4 lg:max-w-3/4 ml-auto mr-0 w-full">
            <h2 className="font-bold lg:mb-2">Контакты</h2>
            <div>
              <p>по вопросам ВКР 2027</p>
              <h3>Кира Соловьева</h3>
              <Link href="mailto:kvsoloveva@itmo.ru" className="w-fit">
                kvsoloveva@itmo.ru
              </Link>
            </div>
          </div>
        </div>
        */}
      </section>
    </main>
  );
}
