import Breadcrumbs from "@/components/breadcrumbs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "next/link";
import PdfIcon from "@public/pdf.svg";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Lightning from "@public/Lightning.svg";

function PdfLink({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn(
        "px-3 py-2 flex flex-row gap-3 border border-black",
        "w-fit rounded-lg card-hover-effect",
        className
      )}
    >
      <Image src={PdfIcon} alt="PDF" width={24} height={24} />
      {children}
    </Link>
  );
}

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
          <h1>Виды ВКР</h1>
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
              <AccordionTrigger>ВКР 2025 на БиоТехе</AccordionTrigger>
              <AccordionContent>
                <p>Требования к ВКР ИТМО (оформление)</p>
                <p>
                  Гид выпускника ИТМО (этапы подготовки, основные даты, условия
                  для «красного» диплома)
                </p>
                <p>
                  Полезные материалы (инструкции по загрузке документов по ВКР
                  в ИСУ, записи встреч по подготовке к защите ВКР
                  от преподавателей ITMO Soft Skills)
                </p>
                <p>РП ГИА</p>
                <p>РПП («Проектная работа» и «Преддипломная»)</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="2">
              <AccordionTrigger>Типы ВКР</AccordionTrigger>
              <AccordionContent>
                <p>«Классическая» ВКР (индустриальный проект)</p>
                <p>ВКР как бизнес-проект</p>
                <p>ВКР как научная статья</p>
                <p>РП ГИАВКР как арт-проект (только в магистратуре)</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="3">
              <AccordionTrigger>Руководитель ВКР</AccordionTrigger>
              <AccordionContent>
                <p>
                  Руководитель ВКР на ФБТ для всех типов назначается
                  факультетом. Если с руководителем уже есть договоренность о
                  совместной работе, обучающиеся указывают это в форме для
                  дальнейшего согласования факультетом
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="4">
              <AccordionTrigger>
                <div className="max-lg:flex flex-col">
                  «Классическая» ВКР{" "}
                  <span className="font-normal">(индустриальный проект)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p>
                  «Классическая» или «традиционная» ВКР на факультете
                  биотехнологий осуществляется в формате индустриального проекта
                </p>
                <div className="px-7 space-y-4">
                  <div className="space-y-2">
                    <p className="font-bold">Что такое индустриальный проект</p>
                    <p>
                      Проектная работа по заказу индустриального партнера,
                      которую выполняют обучающиеся бакалавриата или
                      магистратуры ФБТ на выпускном курсе
                    </p>
                    <p>
                      Успешное выполнение проекта подтверждает
                      квалификацию биотехнолога и позволяет получить диплом
                      государственного образца. А также обеспечивает решенный
                      индустриальный кейс, который можно указать в резюме для
                      построения или развития карьеры
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-bold">
                      Как подать заявку выполнение индустриального проекта от
                      компании-партнера факультета:
                    </p>
                    <ol className="list-decimal pl-5">
                      <li>
                        Изучите витрину заданий: 1 лист соответствует 1
                        компании, обратите внимание на разделение
                        бакалавриат/магистратура.
                      </li>
                      <li>
                        Внимательно ознакомьтесь с информацией об организации:
                        город нахождения, адрес, график, требуемое гражданство.
                      </li>
                      <li>
                        Выберите задание (можно несколько), на которое хотите
                        подать заявку.
                      </li>
                      <li>
                        Подготовьте резюме (если хотите его улучшить —
                        обращайтесь к карьерному консультанту ФБТ Надежде
                        Серовой{" "}
                        <Link
                          href="mailto:serova@itmo.ru"
                          className="link-hover-underline-compact"
                        >
                          serova@itmo.ru
                        </Link>
                        ). Подготовьте мотивационное письмо, если необходимо
                        (указано в столбце «Условия отбора»).
                      </li>
                      <li>
                        Соберите все необходимые материалы для отбора в 1 файл
                        формата PDF и отправьте с помощью Google-формы: TODO
                        {/* TODO */}
                      </li>
                      <li>
                        Внимание: если вы подаете заявку на несколько заданий
                        одной компании и в условиях отбора этой компании есть
                        мотивационное письмо, опишите свою мотивацию для всех
                        заданий в одном письме. Таким образом, одна компания —
                        одно резюме и, если необходимо, одно мотивационное
                        письмо в одном общем PDF-файле. Дедлайн подачи заявок —
                        1 июня 2024 года включительно.
                      </li>
                      <li>
                        Ждите ответ от компании и, возможно, приглашение
                        на собеседование.
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-2">
                    <p className="font-bold">
                      Даты конкурса на ВКР в формате индустриального проекта
                      (для проектов с витрины):
                    </p>
                    <p>Заявки от студентов принимаются до 1 июня; </p>
                    <p>Компании отбирают кандидатов до 15 июня;</p>
                    <p>
                      Студенты подтверждают желание выполнять индустриальный
                      проект, на который их отобрали (возможно, выбирают
                      из нескольких вариантов, куда они отобрались) до 25 июня
                    </p>
                    <p>
                      Как предложить свой индустриальный проект по месту
                      работы/стажировки
                    </p>
                    <p>
                      Если вы стажируетесь/работаете по специальности и хотите
                      писать ВКР об индустриальном проекте по месту
                      стажировки/работы, укажите подробную информацию
                      об организации и планируемом индустриальном проекте при
                      заполнении 
                      <Link href="#" className="underline">
                        формы
                        {/* TODO */}
                      </Link>
                    </p>
                  </div>

                  <div className="space-y-2 [&>*:not(:first-child)]:underline">
                    <p className="font-bold">
                      Чему может быть посвящен индустриальный проект на ФБТ:
                    </p>
                    <p>Пищевые системы</p>
                    <p>Биофармацевтика</p>
                    <p>Биологически активные вещества</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="5">
              <AccordionTrigger>ВКР как бизнес-проект</AccordionTrigger>
              <AccordionContent>
                При большом спросе будет организована встреча с кураторами
                бизнес-тезисов – сотрудниками ФТМИ ИТМО
                <PdfLink href="#">Регламент</PdfLink>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="6">
              <AccordionTrigger>ВКР как научная статья</AccordionTrigger>
              <AccordionContent>
                Важно: до конца марта 2025 года научная статья должна быть
                опубликована/принята к публикации в один из журналов с SJR
                не ниже 1.3
                <PdfLink href="#">Регламент</PdfLink>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="7">
              <AccordionTrigger>
                <div className="max-lg:flex flex-col">
                  ВКР как арт-проект{" "}
                  <span className="font-normal">(только в магистратуре)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                При большом спросе будет организована встреча с сотрудниками
                Art&Science ИТМО
                <PdfLink href="#">Регламент</PdfLink>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="8">
              <AccordionTrigger>Дедлайн по всем типам ВКР</AccordionTrigger>
              <AccordionContent>
                <p>
                  До 1 июня заполнить форму о выборе типа и наработках ВКР
                  к этому времени;
                </p>
                <p>
                  В течение июня факультет обрабатывает заявки студентов,
                  одобряет/отклоняет выбранные темы и назначает руководителей
                  на одобренные темы.
                </p>
                <p>
                  Итого: 30 июня готово распределение по типам, темам
                  и руководителям ВКР на 2025 год
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="9">
              <AccordionTrigger>Связь Практики и ВКР на ФБТ</AccordionTrigger>
              <AccordionContent>
                <p>
                  Практика (“Проектная работа”) на выпускном курсе – это
                  выделенное время в учебном плане, которое полностью посвящено
                   ВКР
                </p>
                <p>
                  Тем не менее, контрольные точки по согласованию поставленных
                  целей, задач и используемых в ВКР методов исследования
                  начнутся уже осенью 2024 года
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="wrapper">
          <div className="flex flex-col gap-4 lg:max-w-3/4 ml-auto mr-0 w-full">
            <p className="font-bold text-xl lg:text-3xl lg:mb-2">Контакты</p>
            <div>
              <p>по вопросам ВКР 2025</p>
              <p className="text-2xl lg:text-3xl">Кира Соловьева</p>
              <Link
                href="mailto:kvsoloveva@itmo.ru"
                className="link-hover-underline-compact w-fit"
              >
                kvsoloveva@itmo.ru
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
