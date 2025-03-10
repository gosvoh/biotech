import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn, removeHangingPrepositionsAndConjunctions } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import FigureImage from "@/components/figure-image";
import Breadcrumbs from "@/components/breadcrumbs";
import { unstable_cache as cache } from "next/cache";
import { prisma } from "@/prisma";
import type { Member } from "@/lib/db/client";
import { type Metadata } from "next";
import { generateMeta } from "@/lib/meta";

export const metadata: Metadata = generateMeta(
  "Биотех ИТМО | Команда факультета",
  "Команда факультета биотехнологий университета ИТМО",
  "/team"
);

const getMembers = cache(() => prisma.member.findMany(), ["members"], {
  revalidate: 60,
  tags: ["members"],
});
const getDepartments = cache(
  () => prisma.department.findMany(),
  ["departments"],
  {
    revalidate: 60,
    tags: ["departments"],
  }
);

const Card = ({
  member,
  className,
  imgBlock,
}: {
  member: Member;
  className?: string;
  imgBlock?: boolean;
}) => {
  const name = [member.firstName, member.middleName, member.lastName].join(" ");

  return (
    <div
      className={cn(
        "text-base flex flex-col items-center gap-4 group",
        className
      )}
    >
      <Link href={`/team/${member.id}`} className="contents">
        <Image
          src={`/uploads/members/${member.id}.webp`}
          alt={name}
          className={cn(
            imgBlock ? "max-lg:max-w-1/2" : "max-w-1/2",
            "rounded-full aspect-square object-cover border-2 border-day-base-static-bg&stroke-30",
            "group-hover:border-accent transition-colors"
          )}
          width={500}
          height={500}
        />
      </Link>
      <div className="space-y-2 text-center">
        <Link
          href={`/team/${member.id}`}
          className="text-lg font-bold text-center"
        >
          {member.firstName}
          <br />
          {[member.middleName, member.lastName].join(" ")}
        </Link>
        <p>{member.position}</p>
        <div className="*:block *:mx-auto">
          {member.phone && (
            <Link
              href={`tel:${member.phone}`}
              className="hover:text-accent transition-colors duration-300 w-fit"
            >
              {member.phone}
            </Link>
          )}
          <Link
            href={`mailto:${member.email}`}
            className="hover:text-accent transition-colors duration-300 w-fit"
          >
            {member.email}
          </Link>
        </div>
      </div>
    </div>
  );
};

const DevelopmentDepartment = ({ members }: { members: Member[] }) => (
  <>
    <p className="text-day-base-static-text&icons-20 text-base lg:max-w-3/5 lg:mb-20">
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
      {members.map((member) => (
        <Card member={member} imgBlock key={member.id} />
      ))}
    </div>
  </>
);

const ResearchDepartment = ({ members }: { members: Member[] }) => (
  <div className="flex flex-col gap-6 lg:grid lg:gap-y-10 grid-cols-4">
    {members.map((member) => (
      <Card member={member} key={member.id} />
    ))}
  </div>
);

const MobileLayout = ({
  className,
  members,
}: {
  className?: string;
  members: {
    development: Member[];
    research: Member[];
  };
}) => (
  <Accordion type="multiple" className={className}>
    <AccordionItem value="item-1">
      <AccordionTrigger>Отдел развития</AccordionTrigger>
      <AccordionContent>
        <DevelopmentDepartment members={members.development} />
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="item-2">
      <AccordionTrigger>
        Преподаватели/Руководители научных групп
      </AccordionTrigger>
      <AccordionContent>
        <ResearchDepartment members={members.research} />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

const DesktopLayout = ({
  className,
  members,
}: {
  className?: string;
  members: {
    development: Member[];
    research: Member[];
  };
}) => (
  <div className={cn("text-center flex flex-col gap-4", className)}>
    <div className="flex flex-col gap-4 py-20 items-center">
      <h2>Отдел развития</h2>
      <DevelopmentDepartment members={members.development} />
    </div>
    <div className="flex flex-col gap-4 py-20">
      <h2 className="mb-20">Преподаватели/Руководители научных групп</h2>
      <ResearchDepartment members={members.research} />
    </div>
  </div>
);

export default async function Team() {
  const members = await getMembers();
  const departments = await getDepartments();

  const development = members.filter(
    (member) => member.departmentId === departments[0]?.id
  );
  const research = members.filter(
    (member) => member.departmentId === departments[1]?.id
  );
  const membersByDepartment = { development, research };

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
          <MobileLayout className="lg:hidden" members={membersByDepartment} />
          <DesktopLayout
            className="max-lg:hidden"
            members={membersByDepartment}
          />
        </div>
      </section>
    </main>
  );
}
