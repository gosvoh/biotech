import Breadcrumbs from "@/components/breadcrumbs";
import FigureImage from "@/components/figure-image";
import SoftStar from "@public/Soft Star.svg";
import SoftStarBig from "@public/Soft Star Big.svg";
import Image from "next/image";
import { unstable_cache as cache } from "next/cache";
import { prisma } from "@/prisma";
import type { Publication } from "@/lib/db/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "next/link";
import NewsCard from "@/components/news-card";
import { Button } from "@/components/ui/button";
import ResearchHover from "@public/research.jpg";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

const RNFProjects: string[] = [
  "Интеллектуальный биоразлагаемый упаковочный материал для пищевых продуктов",
  "Разработка научно-технических основ контроля качества и безопасности мясных продуктов с помощью гиперспектрального анализа и терагерцового излучения",
  "Разработка биоактивного функционального пищевого ингредиента на основе арахидоновой кислоты и пробиотических штаммов лактобактерий для профилактики сахарного диабета второго типа",
  "Применение биопотенциала адаптогенных БАВ из растительного сырья для создания новых функциональных продуктов питания с пробиотическим эффектом для активного долголетия и здоровья",
  "Научно-технологические основы получения бактериальной наноцеллюлозы на субстратах из соевой мелассы",
];

const EFFIProjects: string[] = [
  "Получение бактериоцинов пробиотических штаммов лактобацилл и изучение их структуры, функций и свойств для использования в качестве пищевых биоконсервантов.",
];

const getPublications = cache(
  () => prisma.publication.findMany(),
  ["publications"],
  {
    revalidate: 60,
    tags: ["publications"],
  }
);

const Publications = async () => {
  const publications = (await getPublications()).reduce((acc, publication) => {
    if (!acc[publication.year]) acc[publication.year] = [];
    acc[publication.year].push(publication);
    return acc;
  }, {} as Record<Publication["year"], Publication[]>);

  return (
    <Accordion type="multiple">
      {Object.entries(publications).map(([year, publications]) => (
        <AccordionItem key={year} value={year}>
          <AccordionTrigger className="text-base">
            Публикации {year}
          </AccordionTrigger>
          <AccordionContent>
            <ul>
              {publications.map((publication) => (
                <li key={publication.id}>
                  <Link
                    href={publication.link}
                    className="hover:underline text-brand3"
                  >
                    {publication.authors}
                  </Link>{" "}
                  {publication.title}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default function Research() {
  return (
    <main className="md:flex md:flex-col">
      <section className="md:pb-20">
        <Breadcrumbs
          items={[{ title: "Главная", href: "/" }, { title: "Исследования" }]}
        />
        <div className="wrapper flex flex-col-reverse lg:flex-row gap-10 lg:items-end">
          <h1 className="flex-1">Исследования</h1>
          <FigureImage className="flex-1" />
        </div>
      </section>

      <section className="relative flex flex-col gap-10">
        <Image
          src={SoftStar}
          height={138}
          className="absolute -top-4 right-0 md:hidden"
          alt=""
        />
        <Image
          src={SoftStarBig}
          height={350}
          className="absolute top-10 left-0 max-md:hidden 2xl:hidden"
          alt=""
        />
        <Image
          src={SoftStarBig}
          height={500}
          className="absolute top-10 left-0 max-2xl:hidden"
          alt=""
        />
        <div className="wrapper">
          <div className="space-y-4 md:max-w-3/4 md:pl-6 md:ml-auto md:mr-0">
            <h2 className="text-2xl xl:text-4xl text-brand3">БиоТех ИТМО</h2>
            <div className="space-y-2 md:space-y-6 xl:[&>p]:text-2xl">
              <p className="font-bold text-xl md:mb-6 xl:!text-3xl">
                Инновации и передовые исследования в науке и промышленности
              </p>
              <p>
                На факультете биотехнологий Университета ИТМО ведутся передовые
                исследования, направленные на решение актуальных задач науки
                и промышленности
              </p>
              <p>
                Наши ученые разрабатывают инновационные подходы в биомедицине,
                экологии и пищевых технологиях, активно участвуя в национальных
                и международных научных проектах
              </p>
              <p>
                Факультет является исполнителем множества грантов,
                поддерживаемых Российским научным фондом (РНФ) и Российским
                фондом фундаментальных исследований (РФФИ), что позволяет нашим
                студентам принимать участие в реальных научных проектах
                и вносить вклад в передовые исследования, совмещая обучение
                с работой над актуальными задачами науки
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-0 md:hidden">
        <div className="wrapper gap-4">
          <Accordion type="multiple">
            <AccordionItem value="rnf">
              <AccordionTrigger>Проекты РНФ</AccordionTrigger>
              <AccordionContent>
                {RNFProjects.map((project, i) => (
                  <NewsCard
                    key={project}
                    date={`[${(i + 1).toString().padStart(2, "0")}]`}
                    title={project}
                    className="p-6"
                    classNames={{
                      date: "text-lg",
                      title: "text-base",
                    }}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="effi">
              <AccordionTrigger>Проекты ЭФФИ</AccordionTrigger>
              <AccordionContent>
                {EFFIProjects.map((project, i) => (
                  <NewsCard
                    key={project}
                    date={`[${(i + 1).toString().padStart(2, "0")}]`}
                    title={project}
                    className="p-6"
                    classNames={{
                      date: "text-lg",
                      title: "text-base",
                    }}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="publications">
              <AccordionTrigger>Публикации</AccordionTrigger>
              <AccordionContent>
                <Suspense fallback={<div>Загрузка...</div>}>
                  <Publications />
                </Suspense>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <section className="max-md:hidden">
        <div className="wrapper flex-row gap-6">
          <h2 className="basis-1/4">Проекты РНФ</h2>
          <div className="basis-3/4 grid grid-cols-1 xl:grid-cols-2 gap-6">
            {RNFProjects.map((project, i) => (
              <NewsCard
                key={project}
                date={`[${(i + 1).toString().padStart(2, "0")}]`}
                title={project}
                classNames={{
                  date: "text-xl",
                  title: "text-2xl",
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="max-md:hidden">
        <div className="wrapper flex-row gap-6">
          <h2 className="basis-1/4">Проекты ЭФФИ</h2>
          <div className="basis-3/4 grid grid-cols-1 xl:grid-cols-2 gap-6">
            {EFFIProjects.map((project, i) => (
              <NewsCard
                key={project}
                date={`[${(i + 1).toString().padStart(2, "0")}]`}
                title={project}
                classNames={{
                  date: "text-xl",
                  title: "text-2xl",
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="accent-gradient md:py-20">
        <div className="wrapper gap-6 md:relative">
          <div
            className={cn(
              "max-lg:hidden",
              "absolute top-0 bottom-0 right-0",
              "h-full w-auto",
              "group"
            )}
          >
            <div
              className={cn(
                "rounded-full aspect-square h-10/12 bg-card",
                "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              )}
            />
            <div
              className={cn(
                "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
                "w-full h-11/12"
              )}
            >
              <div
                className={cn(
                  "rounded-full aspect-square h-full bg-white",
                  "group-hover:transform group-hover:-translate-x-1/10",
                  "transition-transform duration-300"
                )}
              />
            </div>
            <Image
              src={ResearchHover}
              className={cn(
                "rounded-full aspect-square object-cover",
                "border-2 border-white",
                "h-full w-auto relative",
                "group-hover:transform group-hover:-translate-x-3/10",
                "transition-transform duration-300"
              )}
              alt=""
            />
          </div>
          <div className="flex flex-col gap-6 lg:max-w-1/2 xl:max-w-3/4">
            <p className="font-bold text-2xl md:text-3xl lg:text-4xl max-md:text-center md:mb-4">
              На странице «Команда»
            </p>
            <p className="max-md:text-center md:text-balance md:text-2xl">
              вы можете узнать больше о проектах факультета, выбрать научного
              руководителя и связаться с сотрудниками для получения
              дополнительной информации о текущих исследованиях
            </p>
            <Link href="/team" className="contents">
              <Button variant="outline" className="md:w-fit">
                Перейти
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-md:hidden">
        <div className="wrapper">
          <h2>Проекты ЭФФИ</h2>
          <Suspense fallback={<div>Загрузка...</div>}>
            <Publications />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
