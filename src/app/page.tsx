import Image from "next/image";
import { Button } from "@/components/ui/button";
import Bag from "@public/bag.png";
import Mvk from "@public/mvk.png";
import Link from "next/link";
import { generateMeta } from "@/lib/meta";
import type { Metadata } from "next";
import Carousel from "@/components/carousel";
import Timeline from "@/components/timeline";
import { ArrowUpRight } from "lucide-react";
import { removeHangingPrepositionsAndConjunctions } from "@/lib/utils";
import FigureImage from "@/components/figure-image";

export const metadata: Metadata = generateMeta(
  "БиоТех ИТМО",
  "Факультет биотехнологий университета ИТМО"
);

export default function Home() {
  return (
    <main className="overflow-hidden">
      <section className="accent-gradient max-md:rounded-b-[60px] max-w-none section-home-padding">
        <div className="wrapper flex flex-col gap-6 md:flex-row-reverse items-center">
          <FigureImage />
          <div className="space-y-6 md:space-y-[42px]">
            <h1 className="text-5xl xl:text-6xl">БиоТех ИТМО</h1>
            <p className="text-xl xl:text-2xl">
              Факультет биотехнологий университета ИТМО
            </p>
          </div>
        </div>
      </section>

      <section className="section-home-padding">
        <div className="wrapper">
          <h2>Новости факультета</h2>
          <div className="space-y-6 wrapper overflow-visible">
            <Carousel>
              <Button className="xl:text-2xl gap-[10px] md:gap-4 max-md:hidden">
                Все новости <ArrowUpRight />
              </Button>
            </Carousel>
            <Button className="xl:text-2xl gap-[10px] md:gap-4 md:hidden">
              Все новости <ArrowUpRight />
            </Button>
          </div>
        </div>
      </section>

      <section className="main-block section-home-padding">
        <div className="wrapper md:flex-row-reverse items-center justify-between">
          <Image src={Bag} alt="" className="md:max-w-3/8" />
          <div className="space-y-6 md:max-w-1/2">
            <div className="space-y-2 md:space-y-4">
              <h2>БиоТех ИТМО</h2>
              <p>
                {removeHangingPrepositionsAndConjunctions(
                  <>
                    Динамично развивающийся факультет, где биотехнология,
                    биофармацевтика и пищевые науки разворачиваются в тесной
                    взаимосвязи с индустрией
                  </>
                )}
              </p>
            </div>
            <Button>Образование</Button>
          </div>
        </div>
        <div className="wrapper">
          <h3>История факультета</h3>
          <Timeline
            steps={[
              {
                date: "1772",
                text: removeHangingPrepositionsAndConjunctions(
                  <>
                    Основание Императорского коммерческого училища, наследником
                    которого стал Институт холодильной промышленности
                  </>
                ),
              },
              {
                date: "1931",
                text: "Основание Института холодильной промышленности",
              },
              {
                date: "2011",
                text: removeHangingPrepositionsAndConjunctions(
                  <>
                    Присоединение Института холодильной промышленности к
                    Университету ИТМО и его преобразование в Институт холода и
                    биотехнологий
                  </>
                ),
              },
              {
                date: "2015",
                text: removeHangingPrepositionsAndConjunctions(
                  <>
                    Расформирование Института холода и биотехнологий, создание
                    факультета холодильной, криогенной техники и
                    кондиционирования, а также факультета пищевых биотехнологий
                    и инженерии
                  </>
                ),
              },
              {
                date: "2020",
                text: "Начало новейшей истории факультета биотехнологий",
              },
            ]}
          />
        </div>
      </section>

      <section className="section-home-padding max-md:p-0">
        <div className="wrapper">
          <div className="accent-gradient md:rounded-3xl section-padding section-home-padding gap-6 main-block xl:flex-row md:gap-[48px] items-center justify-center">
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
                {removeHangingPrepositionsAndConjunctions(
                  <>
                    БиоТех Университета ИТМО рад открыть для вас свои двери.
                    Здесь, в самом сердце Санкт-Петербурга, под одним флагом
                    объединены фуд-, эко-, агро- и геномные биотехнологии.
                    Развиваемая на факультете экосистема создаст атмосферу
                    успеха и для обучающихся, заинтересованных в инжиниринге
                    собственного будущего, и для экспертов, стремящихся
                    реализовать своё самое смелое, часто опережающее время
                    видение. Индустриально-образовательное партнёрство и
                    интернационализация, образование, отвечающее потребностям
                    реального сектора экономики — фундамент, на котором твёрдо
                    стоит БиоТех сегодня.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-home-padding">
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
  );
}
