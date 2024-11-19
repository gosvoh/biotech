import { unstable_cache as cache } from "next/cache";
import { prisma } from "@/prisma";
import Breadcrumbs from "@/components/breadcrumbs";
import Image from "next/image";
import { notFound } from "next/navigation";
import { removeHangingPrepositionsAndConjunctions } from "@/lib/utils";
import Link from "next/link";

const getMember = cache(
  (id: string) =>
    prisma.member.findUnique({
      where: { id },
      include: { disciplines: true, scientificWorks: true },
    }),
  ["members"],
  {
    revalidate: 60,
    tags: ["members"],
  }
);

export default async function Member({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const member = await getMember((await params).id);

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
              src={`/uploads/members/${member.id}.webp`}
              alt={[member.firstName, member.middleName, member.lastName].join(
                " "
              )}
              priority
              width={350}
              height={350}
              placeholder="blur"
              className="rounded-full aspect-square object-cover w-1/2 xl:w-1/4"
            />
            <div className="md:space-y-4">
              <h1 className="text-brand3 font-bold text-2xl md:text-4xl xl:text-5xl">
                {member.firstName}
              </h1>
              <p className="font-bold text-xl md:text-2xl xl:text-3xl">
                {[member.middleName, member.lastName].join(" ")}
              </p>
              {member.position && (
                <p className="md:text-xl xl:text-2xl">{member.position}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="md:text-xl">
        <div className="wrapper">
          <div className="space-y-4 md:space-y-6">
            <p className="font-bold md:text-3xl">
              {removeHangingPrepositionsAndConjunctions(
                <>Преподаваемые дисциплины в 2024–2025 гг:</>
              )}
            </p>
            <ul className="list-disc list-inside">
              {member.disciplines.map((x) => (
                <li key={`discipline-${x.id}`}>
                  {removeHangingPrepositionsAndConjunctions(x.title)}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <p className="font-bold md:text-3xl">Темы научных работ:</p>
            <ul className="list-disc list-inside">
              {member.scientificWorks.map((x) => (
                <li key={`scientific-work-${x.id}`}>
                  {removeHangingPrepositionsAndConjunctions(x.title)}
                </li>
              ))}
            </ul>
          </div>
          {(member.phone || member.email) && (
            <div className="space-y-4 md:space-y-6">
              <p className="font-bold md:text-3xl">Контакты</p>
              <div>
                {member.phone && (
                  <Link
                    href={`tel:${member.phone}`}
                    className="link-hover-underline compact"
                  >
                    {member.phone}
                  </Link>
                )}
                {member.email && (
                  <Link
                    href={`mailto:${member.email}`}
                    className="link-hover-underline compact"
                  >
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
