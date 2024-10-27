import Image from "next/image";
import Landing from "@public/landing.png";
import Landing1 from "@public/landing1.png";
import Landing2 from "@public/landing2.png";
import { Button } from "@/components/ui/button";
import Bag from "@public/bag.png";
import Mvk from "@public/mvk.png";
import Link from "next/link";
import { generateMeta } from "@/lib/meta";
import type { Metadata } from "next";

export const metadata: Metadata = generateMeta(
  "Biotech.Industries",
  "Создаем инновации в биотех-индустрии"
);

export default function Home() {
  return (
    <div className="">
      <main className="">
        <section className="accent-gradient max-md:rounded-b-[60px] max-w-none">
          <div className="wrapper flex flex-col gap-6 md:flex-row-reverse items-center">
            <div className="relative">
              <Image
                src={Landing1}
                alt=""
                className="absolute top-0 left-0 rounded-full aspect-square object-cover max-w-11/40"
              />
              <Image
                src={Landing2}
                alt=""
                className="absolute bottom-0 right-0 rounded-full aspect-square object-cover max-w-11/40"
              />
              <Image src={Landing} alt="" priority />
            </div>
            <div className="space-y-6 md:space-y-[42px]">
              <h1>БиоТех ИТМО</h1>
              <p className="text-xl xl:text-2xl">
                Факультет биотехнологий университета ИТМО
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="wrapper">
            <h2>Новости факультета</h2>
            <div className="space-y-6">
              <div className="border border-black rounded-2.5xl h-[530px]"></div>
              <Button className="xl:text-2xl">Все новости</Button>
            </div>
          </div>
        </section>

        <section className="main-block">
          <div className="wrapper md:flex-row-reverse items-center justify-between">
            <Image src={Bag} alt="" className="md:max-w-3/8" />
            <div className="space-y-6 md:max-w-1/2">
              <div className="space-y-2 md:space-y-4">
                <h2>БиоТех ИТМО</h2>
                <p>
                  Динамично развивающийся факультет, где биотехнология,
                  биофармацевтика и пищевые науки разворачиваются в тесной
                  взаимосвязи с индустрией
                </p>
              </div>
              <Button>Образование</Button>
            </div>
          </div>
          <div className="wrapper">
            <h3>История факультета</h3>
          </div>
        </section>

        <section className="max-md:p-0">
          <div className="wrapper">
            <div className="accent-gradient md:rounded-3xl p-20 gap-6 main-block xl:flex-row md:gap-[48px] items-center justify-center">
              <Image
                src={Mvk}
                alt=""
                className="rounded-full object-cover aspect-square md:max-w-1/2 xl:max-w-1/4"
              />
              <div className="space-y-6 xl:max-w-1/2">
                <div className="space-y-2">
                  <h3>Михаил Курушкин</h3>
                  <p className="xl:text-lg">Декан факультета</p>
                </div>
                <p className="text-base">
                  БиоТех Университета ИТМО рад открыть для вас свои двери.
                  Здесь, в самом сердце Санкт-Петербурга, под одним флагом
                  объединены фуд-, эко-, агро- и геномные биотехнологии.
                  Развиваемая на факультете экосистема создаст атмосферу успеха
                  и для обучающихся, заинтересованных в инжиниринге собственного
                  будущего, и для экспертов, стремящихся реализовать своё самое
                  смелое, часто опережающее время видение.
                  Индустриально-образовательное партнёрство и
                  интернационализация, образование, отвечающее потребностям
                  реального сектора экономики — фундамент, на котором твёрдо
                  стоит БиоТех сегодня.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrapper">
            <h2>Жизнь на БиоТехе</h2>
            <div className="flex flex-col gap-6 lg:flex-row lg:flex-wrap [&>*]:lg:flex-[1_1_45%]">
              <Link href="#" className="card">
                Food Biotechnology Lab
              </Link>
              <Link href="#" className="card">
                Стажировки
              </Link>
              <Link href="#" className="card">
                Проект «Амбассадоры науки»
              </Link>
              <Link href="#" className="card">
                BioTech Careers
              </Link>
              <Link href="#" className="card">
                Сообщество факультета в ВК
              </Link>
              <Link href="#" className="card">
                Интенсив «Проектная деятельность»
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
