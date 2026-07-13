import { generateMeta } from "@/lib/meta";
import Mvk from "@public/mvk.jpg";
import type { Metadata } from "next";
import Image from "next/image";
// import Timeline from "@/components/timeline";
import FigureImage from "@/components/figure-image";
import NewsCarouselSection from "@/components/news-carousel-section";
import { removeHangingPrepositionsAndConjunctions } from "@/lib/utils";

export const metadata: Metadata = generateMeta(
  "Биотех ИТМО",
  "Факультет биотехнологий Университета ИТМО",
);

export default function Home() {
  return (
    <main className="overflow-hidden">
      <section className="accent-gradient max-md:rounded-b-[60px] max-w-none section-home-padding">
        <div className="wrapper flex flex-col gap-6 md:flex-row-reverse items-center justify-between xxl:justify-around">
          <FigureImage className="md:max-w-1/2" />
          <div className="space-y-6 md:space-y-[42px]">
            <h1>
              Биотех <br className="max-md:hidden" />
              ИТМО
            </h1>
            <h3>
              Факультет биотехнологий <br className="max-md:hidden" />
              Университета ИТМО
            </h3>
          </div>
        </div>
      </section>

      <NewsCarouselSection />

      <section className="main-block section-home-padding">
        {/* Временно скрыт блок "Приветствие декана"
        <div className="wrapper md:flex-row-reverse items-center justify-between">
          <Image src={Bag} alt="" className="md:max-w-3/8" />
          <Image src={Mvk} alt="" className="md:max-w-3/8 rounded-full" />
          <div className="space-y-6 md:max-w-1/2">
            <div className="space-y-2 md:space-y-4">
              <h2>Биотех ИТМО</h2>
              <p>
                {removeHangingPrepositionsAndConjunctions(
                  <>
                    Динамично развивающийся факультет, где биотехнология,
                    биофармацевтика и пищевые науки разворачиваются в тесной
                    взаимосвязи с индустрией
                  </>,
                )}
              </p>
              <h2>Приветствие декана</h2>
              <p>
                {removeHangingPrepositionsAndConjunctions(
                  <>
                    Биотех Университета ИТМО рад открыть для вас свои двери.
                    Здесь, в самом сердце Санкт-Петербурга, под одним флагом
                    объединены фуд-, эко-, агро- и геномные биотехнологии.
                    Развиваемая на факультете экосистема создаст атмосферу
                    успеха и для обучающихся, заинтересованных в инжиниринге
                    собственного будущего, и для экспертов, стремящихся
                    реализовать своё самое смелое, часто опережающее время
                    видение. Индустриально-образовательное партнёрство и
                    интернационализация, образование, отвечающее потребностям
                    реального сектора экономики — фундамент, на котором твёрдо
                    стоит Биотех сегодня.
                  </>,
                )}
              </p>
            </div>
            <Button asChild>
              <Link href="/education">Образование</Link>
            </Button>
          </div>
        </div>
        */}
        {/* <div className="wrapper">
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
        </div> */}
      </section>

      {/* <section className="section-home-padding max-md:p-0">
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
                    Биотех Университета ИТМО рад открыть для вас свои двери.
                    Здесь, в самом сердце Санкт-Петербурга, под одним флагом
                    объединены фуд-, эко-, агро- и геномные биотехнологии.
                    Развиваемая на факультете экосистема создаст атмосферу
                    успеха и для обучающихся, заинтересованных в инжиниринге
                    собственного будущего, и для экспертов, стремящихся
                    реализовать своё самое смелое, часто опережающее время
                    видение. Индустриально-образовательное партнёрство и
                    интернационализация, образование, отвечающее потребностям
                    реального сектора экономики — фундамент, на котором твёрдо
                    стоит Биотех сегодня.
                  </>,
                )}
              </p>
            </div>
          </div>
        </div>
      </section> */}

      {/* <section className="section-home-padding">
        <div className="wrapper">
          <h2>Жизнь на Биотехе</h2>
          <div className="flex flex-col gap-6 lg:flex-row lg:flex-wrap *:lg:flex-[1_1_45%]">
            <div className="card">Food Biotechnology Lab</div>
            <div className="card">Стажировки</div>
            <div className="card">Проект «Амбассадоры науки»</div>
            <div className="card">BioTech Careers</div>
            <div className="card">Сообщество факультета в ВК</div>
            <div className="card">Интенсив «Проектная деятельность»</div>
          </div>
        </div>
      </section> */}
    </main>
  );
}
