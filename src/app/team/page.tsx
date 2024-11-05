import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn, removeHangingPrepositionsAndConjunctions } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import Mvk from "@public/mvk.png";
import FigureImage from "@/components/figure-image";
import Breadcrumbs from "@/components/breadcrumbs";

const Card = ({
  image,
  name,
  position,
  email,
  tel,
  className,
  imgBlock,
}: {
  image: React.ComponentProps<typeof Image>["src"];
  name: string;
  position: string;
  email: string;
  tel?: string;
  className?: string;
  imgBlock?: boolean;
}) => {
  const [lastName, firstName, middleName] = name.split(" ");

  return (
    <div
      className={cn("text-base flex flex-col items-center gap-4", className)}
    >
      <Image
        src={image}
        alt={name}
        className={cn(
          "rounded-full aspect-square object-cover",
          imgBlock ? "max-lg:max-w-1/2" : "max-w-1/2"
        )}
      />
      <div className="flex flex-col gap-2 items-center text-center">
        <div className="">
          <p className="text-brand3 text-xl font-bold">{lastName}</p>
          <p className="text-lg font-bold">
            {`${firstName} ${middleName ? middleName : ""}`.trim()}
          </p>
        </div>
        <p>{position}</p>
        <div className="[&>*]:block">
          {tel && <Link href={`tel:${tel}`}>{tel}</Link>}
          <Link href={`mailto:${email}`}>{email}</Link>
        </div>
      </div>
    </div>
  );
};

const DevelopmentDepartment = () => (
  <>
    <p className="text-special-dark-gray text-base lg:max-w-3/5 lg:mb-20">
      {removeHangingPrepositionsAndConjunctions(
        <>
          Отдел развития факультета занимается стратегическим планированием,
          улучшением образовательных программ, проектной деятельностью и
          налаживанием партнёрств для повышения конкурентоспособности и роста
          факультета.
        </>
      )}
    </p>
    <div className="flex flex-col gap-6 lg:grid lg:gap-y-10 grid-cols-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <Card
          image={Mvk}
          name="Султанова Светлана Юрьевна"
          position="Вице-декан"
          email="sysultanova@itmo.ru"
          imgBlock
          key={`card-dev-${i}`}
        />
      ))}
    </div>
  </>
);

const ResearchDepartment = () => (
  <div className="flex flex-col gap-6 lg:grid lg:gap-y-10 grid-cols-4">
    {Array.from({ length: 20 }).map((_, i) => (
      <Card
        image={Mvk}
        name="Султанова Светлана Юрьевна"
        position="Вице-декан"
        email="sysultanova@itmo.ru"
        tel="+7 (812) 123-45-67"
        key={`card-res-${i}`}
      />
    ))}
  </div>
);

const MobileLayout = ({ className }: { className?: string }) => (
  <Accordion type="multiple" className={className}>
    <AccordionItem value="item-1">
      <AccordionTrigger>Отдел развития</AccordionTrigger>
      <AccordionContent>
        <DevelopmentDepartment />
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="item-2">
      <AccordionTrigger>
        Преподаватели/Руководители научных групп
      </AccordionTrigger>
      <AccordionContent>
        <ResearchDepartment />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

const DesktopLayout = ({ className }: { className?: string }) => (
  <div className={cn("text-center flex flex-col gap-4", className)}>
    <div className="flex flex-col gap-4 py-20 items-center">
      <h2>Отдел развития</h2>
      <DevelopmentDepartment />
    </div>
    <div className="flex flex-col gap-4 py-20">
      <h2 className="mb-20">Преподаватели/Руководители научных групп</h2>
      <ResearchDepartment />
    </div>
  </div>
);

export default function Team() {
  return (
    <main>
      <section>
        <Breadcrumbs
          items={[{ title: "Главная", href: "/" }, { title: "Команда" }]}
        />
        <div className="wrapper flex flex-row gap-10 items-end">
          <h1 className="flex-1">Команда факультета</h1>
          <FigureImage className="flex-1 max-lg:hidden" />
        </div>
      </section>

      <section className="">
        <div className="wrapper">
          <MobileLayout className="lg:hidden" />
          <DesktopLayout className="max-lg:hidden" />
        </div>
      </section>
    </main>
  );
}
