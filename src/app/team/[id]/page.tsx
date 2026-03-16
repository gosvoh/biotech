import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/prisma";
import Breadcrumbs from "@/components/breadcrumbs";
import Image from "next/image";
import { notFound } from "next/navigation";
import { removeHangingPrepositionsAndConjunctions } from "@/lib/utils";
import Link from "next/link";
import { type Metadata, type ResolvingMetadata } from "next";
import type { Member } from "@/lib/db/client";
import { Suspense } from "react";

export async function getMember(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("members");
  return prisma.member.findUnique({
    where: { id },
    include: { disciplines: true, scientificWorks: true },
  });
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const id = (await params).id;
  const member = await getMember(id);
  const parentMeta = await parent;

  if (!member) return parentMeta as Metadata;

  const memberName = [
    member.firstName,
    member.middleName,
    member.lastName,
  ].join(" ");

  return {
    ...(parentMeta as Metadata),
    title: `Биотех ИТМО | ${memberName}`,
    description: `Команда факультета биотехнологий Университета ИТМО: ${memberName}`,
    openGraph: { images: { url: `https://biotech.cedne.ru/team/${id}` } },
    twitter: { images: { url: `https://biotech.cedne.ru/team/${id}` } },
  };
}

async function MemberContent({ params }: { params: Promise<{ id: string }> }) {
  const member = await getMember((await params).id);
  const memberNameClassName =
    "font-gorizont text-[30px] leading-[40px] md:text-[36px] md:leading-[46px] xl:text-[50px] xl:leading-[60px] xl:font-normal";
  const sectionHeadingClassName =
    "text-[22px] leading-[32px] xl:text-[28px] xl:leading-[38px]";

  if (!member) notFound();

  return (
    <main>
      <section className="max-md:pb-0">
        <div>
          <Breadcrumbs
            items={[
              { title: "Главная", href: "/" },
              { title: "Команда", href: "/team" },
              {
                title: [
                  member.firstName,
                  member.middleName,
                  member.lastName,
                ].join(" "),
              },
            ]}
          />
          <div className="wrapper flex flex-col md:flex-row gap-6 md:gap-10 md:items-center">
            <Image
              src={`/uploads/members/${member.image ?? member.id}.webp`}
              alt={[member.firstName, member.middleName, member.lastName].join(
                " ",
              )}
              priority
              width={350}
              height={350}
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 38vw, 50vw"
              quality={90}
              className="rounded-full aspect-square object-cover w-1/2 xl:w-1/4"
            />
            <div className="md:space-y-4">
              <h1 className={memberNameClassName}>
                <span className="block">{member.firstName}</span>
                <span className="block">
                  {[member.middleName, member.lastName].join(" ")}
                </span>
              </h1>
              {member.position && (
                <p className={sectionHeadingClassName}>{member.position}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="xl:text-xl">
        <div className="wrapper">
          {member.disciplines.length > 0 && (
            <div className="space-y-4 md:space-y-6">
              <h2 className={sectionHeadingClassName}>
                {removeHangingPrepositionsAndConjunctions(
                  <>Преподаваемые дисциплины в 2024–2025 гг:</>,
                )}
              </h2>
              <ul className="list-disc ml-8">
                {member.disciplines.map((x) => (
                  <li key={`discipline-${x.id}`}>
                    {removeHangingPrepositionsAndConjunctions(x.title)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {member.scientificWorks.length > 0 && (
            <div className="space-y-4">
              <h2 className={sectionHeadingClassName}>Темы научных работ:</h2>
              <ul className="list-disc ml-8">
                {member.scientificWorks.map((x) => (
                  <li key={`scientific-work-${x.id}`}>
                    {removeHangingPrepositionsAndConjunctions(x.title)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(member.phone || member.email) && (
            <div className="space-y-4 md:space-y-6">
              <h2 className={sectionHeadingClassName}>Контакты</h2>
              <div>
                {member.phone && (
                  <Link href={`tel:${member.phone}`} className="block">
                    {member.phone}
                  </Link>
                )}
                {member.email && (
                  <Link href={`mailto:${member.email}`} className="block">
                    {member.email}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function Member({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <MemberContent params={params} />
    </Suspense>
  );
}
