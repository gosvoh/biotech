import Breadcrumbs from "@/components/breadcrumbs";
import MarkdownRender from "@/components/markdown-render";
import Tag from "@/components/tag";
import dayjs from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { prisma } from "@/prisma";
import { unstable_cache as cache } from "next/cache";
import { notFound } from "next/navigation";
import vkLogo from "@public/vkLogo.svg";
import tgLogo from "@public/tgLogo.svg";
import Link from "next/link";
import Image from "next/image";

const getNews = cache(
  (id: string) =>
    prisma.news.findUnique({ where: { id }, include: { tags: true } }),
  ["news"],
  {
    revalidate: 60,
    tags: ["news"],
  }
);

export default async function News({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;
  const news = await getNews(id);

  if (!news) notFound();

  let socialLinks: SocialLinks | undefined = undefined;
  try {
    socialLinks = JSON.parse(news.links);
  } catch {}

  return (
    <main>
      <section className="space-y-6">
        <Breadcrumbs
          items={[
            { title: "Главная", href: "/" },
            { title: "Новости", href: "/news" },
            { title: news.title },
          ]}
        />
        <div className="wrapper">
          <h1>Новости</h1>
        </div>
      </section>

      <section>
        <div className="wrapper">
          <div className="flex gap-2 md:gap-4 flex-wrap justify-center">
            {news.tags.map((tag) => (
              <Tag active key={`news-tag-${tag.id}`}>
                {tag.title}
              </Tag>
            ))}
          </div>
          <div className="lg:max-w-3/4 mx-auto w-full space-y-6 md:space-y-10">
            <Image
              src={`/uploads/news/${news.id}.webp`}
              alt={news.title}
              width={800}
              height={400}
              className="object-cover rounded-2.75xl aspect-square md:aspect-video w-full max-md:max-h-[300px]"
            />
            <p className="text-brand3">{dayjs(news.date).format("LL")}</p>
            <h2 className="text-2xl lg:text-4xl text-accent-carbon !mt-4">
              {news.title}
            </h2>
            <MarkdownRender
              source={news.text}
              className={cn(
                "!text-base md:!text-lg",
                "[&>h3]:!text-lg [&>h3]:md:!text-xl"
              )}
            />
            {socialLinks && (
              <div className="flex gap-6">
                {socialLinks.vkLink && (
                  <Link
                    href={socialLinks.vkLink}
                    target="_blank"
                    className="w-fit block"
                  >
                    <Image
                      src={vkLogo}
                      alt="VK"
                      width={40}
                      height={40}
                      className="hover:scale-110 transition-all"
                    />
                  </Link>
                )}
                {socialLinks.tgLink && (
                  <Link
                    href={socialLinks.tgLink}
                    target="_blank"
                    className="w-fit block"
                  >
                    <Image
                      src={tgLogo}
                      alt="Telegram"
                      width={40}
                      height={40}
                      className="hover:scale-110 transition-all"
                    />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
