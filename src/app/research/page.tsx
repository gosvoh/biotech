import Breadcrumbs from "@/components/breadcrumbs";
import FigureImage from "@/components/figure-image";
import SoftStar from "@public/Soft Star.svg";
import SoftStarBig from "@public/Soft Star Big.svg";
import Image from "next/image";
import { cacheLife, cacheTag } from "next/cache";
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
import { type Metadata } from "next";
import { generateMeta } from "@/lib/meta";

export const metadata: Metadata = generateMeta(
  "Биотех ИТМО | Исследования",
  "Исследования факультета биотехнологий Университета ИТМО",
  "/research",
);

type Project = { id: string; title: string; href?: string };

const RNFProjects: Project[] = [
  {
    id: "25-26-00604",
    title:
      "Биотехнологический потенциал Rhizopus spp. для биотрансформации растительного сырья и создания новых функциональных продуктов питания с заданными характеристиками",
    href: "https://rscf.ru/project/25-26-00604/",
  },
  {
    id: "25-26-00676",
    title:
      "Разработка экологичных антимикробных материалов для контроля биопленок и борьбы с устойчивостью микроорганизмов в пищевой промышленности с применением искусственного интеллекта",
    href: "https://rscf.ru/project/25-26-00676/",
  },
  {
    id: "24-24-00169",
    title:
      "Научно-технологические основы получения бактериальной наноцеллюлозы на субстратах из соевой мелассы",
    href: "https://rscf.ru/project/24-24-00169/",
  },
  {
    id: "23-26-00134",
    title:
      "Разработка микробных заквасок с целью расширения ассортимента хлебобулочных изделий из нетрадиционных видов муки",
    href: "https://rscf.ru/project/23-26-00134/",
  },
  {
    id: "23-26-00056",
    title:
      "Интеллектуальный биоразлагаемый упаковочный материал для пищевых продуктов",
    href: "https://rscf.ru/project/23-26-00056/",
  },
  {
    id: "22-26-00288",
    title:
      "Применение биопотенциала адаптогенных БАВ из растительного сырья для создания новых функциональных продуктов питания с пробиотическим эффектом для активного долголетия и здоровья",
    href: "https://rscf.ru/project/22-26-00288/",
  },
];

const TeenLabProjects: Project[] = [
  {
    id: "FSER-2025-0028",
    title:
      "Лаборатория персонализированных продуктов питания и упаковочных материалов",
  },
];

async function getPublications() {
  "use cache";
  cacheLife("minutes");
  cacheTag("publications");
  return prisma.publication.findMany();
}

const Publications = async () => {
  const publications = (await getPublications()).reduce(
    (acc, publication) => {
      if (!acc[publication.year]) acc[publication.year] = [];
      acc[publication.year].push(publication);
      return acc;
    },
    {} as Record<Publication["year"], Publication[]>,
  );

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
                  <Link href={publication.link} className="hover:underline">
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

export default async function Research() {
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
            <h2>БиоТех ИТМО</h2>
            <div className="space-y-2 md:space-y-6">
              <h3 className="font-bold md:mb-6">
                Фундаментальные научные исследования и инновационные разработки
              </h3>
              <p>
                Факультет биотехнологий проводит фундаментальные и поисковые
                научные исследования в сфере функциональных и специальных
                продуктов питания, технологий пищевых продуктов, а также
                биотехнологии (в том числе бионанотехнологии). Ученые факультета
                активно вовлекают обучающихся в научно-исследовательскую
                деятельность и осуществляют исследования и разработки
                в интересах бизнеса
              </p>
              <p>
                В 2025 году в рамках Национального проекта «Молодежь и дети» на
                факультете открыта Молодежная лаборатория персонализированных
                продуктов питания и упаковочных материалов
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-0 md:hidden">
        <div className="wrapper gap-4">
          <Accordion type="multiple">
            <AccordionItem value="rnf">
              <AccordionTrigger>
                Молодежная лаборатория Минобрнауки
              </AccordionTrigger>
              <AccordionContent>
                {TeenLabProjects.map((project) => (
                  <NewsCard
                    key={project.id}
                    date={`[${project.id}]`}
                    title={project.title}
                    href={project.href}
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
              <AccordionTrigger>Проекты РНФ</AccordionTrigger>
              <AccordionContent>
                {RNFProjects.map((project) => (
                  <NewsCard
                    key={project.id}
                    date={`[${project.id}]`}
                    title={project.title}
                    href={project.href}
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
          <h2 className="basis-1/4 hyphens-auto">
            Моло&shy;дежная лабо&shy;ра&shy;то&shy;рия Мин&shy;обр&shy;науки
          </h2>
          <div className="basis-3/4 grid grid-cols-1 xl:grid-cols-2 gap-6">
            {TeenLabProjects.map((project) => (
              <NewsCard
                key={project.id}
                date={`[${project.id}]`}
                title={project.title}
                href={project.href}
                classNames={{ date: "text-lg" }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="max-md:hidden">
        <div className="wrapper flex-row gap-6">
          <h2 className="basis-1/4">Проекты РНФ</h2>
          <div className="basis-3/4 grid grid-cols-1 xl:grid-cols-2 gap-6">
            {RNFProjects.map((project) => (
              <NewsCard
                key={project.id}
                date={`[${project.id}]`}
                title={project.title}
                href={project.href}
                classNames={{ date: "text-lg" }}
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
              "group",
            )}
          >
            <div
              className={cn(
                "rounded-full aspect-square h-10/12 bg-card",
                "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
              )}
            />
            <div
              className={cn(
                "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
                "w-full h-11/12",
              )}
            >
              <div
                className={cn(
                  "rounded-full aspect-square h-full bg-white",
                  "group-hover:transform group-hover:-translate-x-1/10",
                  "transition-transform duration-300",
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
                "transition-transform duration-300",
              )}
              alt=""
            />
          </div>
          <div className="flex flex-col gap-6 lg:max-w-1/2 xl:max-w-3/4">
            <h2 className="font-bold max-md:text-center md:mb-4">
              На странице «Команда»
            </h2>
            <p className="max-md:text-center md:text-balance">
              вы сможете познакомиться с научными руководителями, их научными
              специальностями и избранными публикациями
            </p>
            <Link href="/team" className="contents">
              <Button variant="outline" className="md:w-fit">
                Перейти
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* <section className="max-md:hidden">
        <div className="wrapper">
          <h2>Публикации</h2>
          <Suspense fallback={<div>Загрузка...</div>}>
            <Publications />
          </Suspense>
        </div>
      </section> */}
    </main>
  );
}
