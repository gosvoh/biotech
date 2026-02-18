import Breadcrumbs from "@/components/breadcrumbs";
import Divider from "@/components/divider";
import FigureImage from "@/components/figure-image";
import RevealSection from "@/components/reveal-section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import EduPirple from "@public/edu_pirple.svg";
import EduGreen from "@public/edu_green.svg";
import EduWhite from "@public/edu_white.svg";
import Image from "next/image";
import type { Metadata } from "next";
import { generateMeta } from "@/lib/meta";

export const metadata: Metadata = generateMeta(
  "Биотех ИТМО | Образование",
  "Образование на факультете биотехнологий университета ИТМО",
  "/education"
);

const OpenDoors = ({
  title,
  className,
}: {
  title: string;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-[14px]", className)}>
    <p className="text-lg max-md:text-center">
      Подробное описание программ и записи дней открытых дверей
    </p>
    <Link href="/#" className="card justify-center text-center md:w-fit">
      {title}
    </Link>
  </div>
);

const BachelorContent = () => (
  <>
    <div className="space-y-4 [&>p:not(.font-bold)]:text-base">
      <p>Образовательная программа бакалавриата</p>
      <p className="font-bold md:text-lg mb-6">
        «Биотехнология» (направление подготовки 19.03.01 Биотехнология)
      </p>
    </div>
    <div className="space-y-4 [&>p:not(.font-bold)]:text-base">
      <p>
        Мы готовим специалистов в области биомедицины (в том числе
        биофармацевтики) и пищевой биотехнологии.
      </p>
      <p>
        Наши выпускники становятся специалистами в исследованиях и разработках
        (R&D), управлении качеством, производстве и сертификации.
      </p>
      <p>
        Дисциплины преподают опытные педагоги высшей школы и практикующие
        эксперты индустрии.
      </p>
      <p>
        Программа спроектирована на основе анализа рынка труда и отвечает
        актуальным компетенциям биотехнолога.
      </p>
      <p>
        Уже со второго семестра студенты выбирают одно из двух основных
        направлений — биофармацевтика или пищевые системы.
      </p>
      <p>
        Последний год обучения полностью посвящен получению практического
        опыта — решению реальных задач индустрии, науки или бизнеса, выбору
        конкретной сферы биотехнологий и работе по специальности.
      </p>
    </div>
    <Divider /> <OpenDoors title="Биотехнология" />
  </>
);

const MasterContent = () => (
  <>
    <div className="space-y-4 [&>p:not(.font-bold)]:text-base">
      <p>Образовательная программа магистратуры</p>
      <p className="font-bold mb-6">
        «ФудТех» (направления подготовки 19.04.01 Биотехнология)
      </p>
    </div>
    <div className="space-y-4 [&>p:not(.font-bold)]:text-base">
      <p>
        Флагманская программа факультета биотехнологий ИТМО; постоянным
        руководителем является Олеся Волох — директор по научным исследованиям,
        изучению питания и разработкам заквасочных культур Health & Nutrition
        (ранее — Danone Россия).
      </p>
      <p>
        ФудТех выпускает новых лидеров пищевой индустрии, способных обеспечить
        продовольственную безопасность страны, занимая ключевые позиции
        в разработке, производстве, управлению качеством и сертификации
        продуктов питания.
      </p>
      <p>
        В течение первого года обучения вы погрузитесь в освоение
        профессиональных дисциплин: нутрициология, AltFood, R&D продуктов
        питания, ответственное производство и многое другое. Доля дисциплин
        по выбору составит 75%.
      </p>
      <p>
        Центральным событием первого года обучения станет работа над командным
        инновационным проектом, подготовленным для вас совместно с лидерами
        индустрии. Второй год обучения полностью посвящён стажировке с выходом
        на выпускную работу.
      </p>
      <p>
        Индустриальный диплом, публикация в топовом журнале в категории Food
        Science или запуск собственного стартапа — выберет студент ФудТеха!
      </p>
      <p>
        Программа реализуется при поддержке престижного гранта
        Благотворительного фонда Владимира Потанина.
      </p>
    </div>
    <Divider className="md:hidden" />
    <OpenDoors className="md:hidden" title="ФудТех" />
    <div className="space-y-4 mt-4 [&>p:not(.font-bold)]:text-base">
      <p>Образовательная программа магистратуры</p>
      <p className="font-bold mb-6">
        «Индустриальная биотехнология» (направление подготовки 19.04.01
        Биотехнология)
      </p>
    </div>
    <div className="space-y-4 [&>p:not(.font-bold)]:text-base">
      <p>Программа реализуется в тесной взаимосвязи с лидерами индустрии.</p>
      <p>
        Постоянным руководителем является Руслан Аль-Шехадат — генеральный
        директор и научный руководитель инновационной биотехнологической
        компании полного цикла Иннова плюс.
      </p>
      <p>
        Индустриальная биотехнология выпускает новых лидеров индустрии,
        способных обеспечить лекарственную и продовольственную безопасность
        страны, занимая ключевые позиции в разработке, производстве, управлению
        качеством, валидации и сертификации биотехнологической продукции.
      </p>
      <p>В первом семестре отбор на треки проведут компании-партнёры:</p>
      <ul className="list-disc pl-6">
        <li>BIOCAD — генотерапевтические лекарственные препараты;</li>
        <li>
          Объединённые пивоварни — иннновационные напитки на растительной основе
          (пиво, пивные напитки, сидры, сладкие газированные напитки);
        </li>
        <li>
          Рустарк — rрупнотоннажное микробиологическое производство
          (органические кислоты, ферменты, аминокислоты);
        </li>
        <li>
          Иннова плюс — инновационная биотехнологическая продукция
          (биофармацевтические препараты, тест-системы, биохимические реагенты,
          рекомбинантные белки).
        </li>
      </ul>
      <p>
        Одним из центральных событий первого года обучения станет работа над
        командным инновационным проектом, подготовленным для вас совместно
        с лидерами индустрии.
      </p>
      <p>
        Второй год обучения полностью посвящён стажировке с выходом на выпускную
        работу. Индустриальный диплом, публикация в топовом журнале в категории
        Biotechnology или запуск собственного стартапа — выберет студент
        Индустриальной биотехнологии!
      </p>
      <p>
        Программа реализуется при поддержке престижного гранта
        Благотворительного фонда Владимира Потанина.
      </p>
    </div>
    <Divider />
    <div className="space-y-[14px]">
      <OpenDoors className="md:hidden" title="Индустриальная биотехнология" />
      <p className="text-lg xl:text-xl">
        Подробное описание программ и записи дней открытых дверей
      </p>
      <div className="flex flex-row gap-6">
        <Link href="/#" className="card flex-grow">
          ФудТех
        </Link>
        <Link href="/#" className="card flex-grow">
          Индустриальная биотехнология
        </Link>
      </div>
    </div>
  </>
);

const PhDContent = () => (
  <>
    <p className="md:text-lg">Аспирантура (научная специальность)</p>
    <div className="space-y-4 font-bold [&>p]:md:text-lg [&>p]:xl:text-xl">
      <p>
        2.7.1. Биотехнологии пищевых продуктов, лекарственных и биологически
        активных веществ (технические науки), обучение 4 года
      </p>
      <p>4.3.3. Пищевые системы (технические науки), обучение 3 года</p>
      <p>
        4.3.5. Биотехнология продуктов питания и биологически активных веществ
        (биологические науки), обучение 3 года
      </p>
      <p>1.5.6. Биотехнология (биологические науки), обучение 4 года</p>
    </div>
  </>
);

const VKRContent = () => (
  <>
    <h3 className="text-center">
      Полезная информация о выпускной квалификационной работе
    </h3>
    <Button className="md:w-fit" asChild>
      <Link href="/education/vkr">Перейти</Link>
    </Button>
  </>
);

export default function Education() {
  return (
    <main className="md:flex md:flex-col">
      <RevealSection className="md:pb-20">
        <Breadcrumbs
          items={[{ title: "Главная", href: "/" }, { title: "Образование" }]}
        />
        <div className="wrapper flex flex-col-reverse lg:flex-row gap-10 lg:items-end">
          <h1 className="flex-1">Образование</h1>
          <FigureImage className="flex-1" />
        </div>
      </RevealSection>

      <RevealSection className="md:hidden">
        <div className="wrapper">
          <Accordion type="multiple">
            <AccordionItem value="bachleor">
              <AccordionTrigger>Бакалавриат</AccordionTrigger>
              <AccordionContent className="gap-6">
                <BachelorContent />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="master">
              <AccordionTrigger>Магистратура</AccordionTrigger>
              <AccordionContent className="gap-6">
                <MasterContent />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="phd">
              <AccordionTrigger>Аспирантура</AccordionTrigger>
              <AccordionContent className="gap-8">
                <PhDContent />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="vkr">
              <AccordionTrigger>Виды ВКР</AccordionTrigger>
              <AccordionContent className="gap-4">
                <VKRContent />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </RevealSection>

      <RevealSection className="max-md:hidden relative py-20">
        <Image
          src={EduPirple}
          height={227}
          className="absolute top-20 left-0"
          alt=""
        />
        <div className="wrapper">
          <div className="max-w-3/4 ml-auto mr-0 space-y-10">
            <h2>Бакалавриат</h2>
            <div className="flex flex-col gap-6">
              <BachelorContent />
            </div>
          </div>
        </div>
      </RevealSection>

      <RevealSection className="max-md:hidden">
        <div
          className={cn(
            "wrapper brand2-gradient items-center gap-6 section-padding rounded-full",
            "border border-black"
          )}
        >
          <h2>Виды ВКР</h2>
          <VKRContent />
        </div>
      </RevealSection>

      <RevealSection className="max-md:hidden relative py-20 mb-10">
        <Image
          src={EduGreen}
          height={227}
          className="absolute top-20 left-0"
          alt=""
        />
        <div className="wrapper">
          <div className="max-w-3/4 ml-auto mr-0 space-y-10">
            <h2>Магистратура</h2>
            <div className="flex flex-col gap-6">
              <MasterContent />
            </div>
          </div>
        </div>
      </RevealSection>

      <RevealSection className="max-md:hidden order-last relative py-[120px]">
        <Image
          src={EduPirple}
          height={227}
          className="absolute top-[120px] left-0"
          alt=""
        />
        <div className="wrapper">
          <div className="max-w-3/4 ml-auto mr-0 space-y-10">
            <h2>Аспирантура</h2>
            <div className="flex flex-col gap-6">
              <PhDContent />
            </div>
          </div>
        </div>
      </RevealSection>

      <RevealSection className="accent-gradient md:py-20">
        <div className="wrapper gap-6 md:relative">
          <Image
            src={EduWhite}
            className="absolute top-0 bottom-0 right-0 h-full max-md:hidden"
            alt=""
          />
          <div className="flex flex-col gap-6 md:max-w-1/2">
            <h2 className="font-bold max-md:text-center md:mb-4">
              Переводами и восстановлениями на все программы занимается
              Студенческий офис
            </h2>
            <h3 className="max-md:text-center md:text-balance">
              Вы можете ознакомиться с порядком перевода здесь
            </h3>
            <Button variant="outline" className="md:w-fit">
              Перейти
            </Button>
          </div>
        </div>
      </RevealSection>
    </main>
  );
}
