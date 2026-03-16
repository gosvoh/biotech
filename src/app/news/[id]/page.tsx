import Breadcrumbs from "@/components/breadcrumbs";
import MarkdownRender from "@/components/markdown-render";
import Tag from "@/components/tag";
import dayjs from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { prisma } from "@/prisma";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import vkLogo from "@public/vkLogo.svg";
import tgLogo from "@public/tgLogo.svg";
import Link from "next/link";
import Image from "next/image";
import NewsImageCarousel from "@/components/news-images-carousel";
import NewsCarouselSection from "@/components/news-carousel-section";
import { type Metadata, type ResolvingMetadata } from "next";
import { Suspense } from "react";

export async function getNews(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("news");
  return prisma.news.findUnique({
    where: { id },
    include: { tags: true, images: true },
  });
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const id = (await params).id;
  const news = await getNews(id);
  const parentMeta = await parent;

  if (!news || news.hidden) return parentMeta as Metadata;

  return {
    ...(parentMeta as Metadata),
    title: `Биотех ИТМО | ${news.title}`,
    description: `Новость факультета биотехнологий Университета ИТМО: ${news.title} от ${news.date}`,
    openGraph: { images: { url: `https://biotech.cedne.ru/news/${id}` } },
    twitter: { images: { url: `https://biotech.cedne.ru/news/${id}` } },
  };
}

async function NewsContent({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const news = await getNews(id);

  if (!news) notFound();

  let socialLinks: SocialLinks | undefined = undefined;
  try {
    socialLinks = JSON.parse(news.links);
  } catch {}

  return (
    <main>
      <section>
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

      <section className="max-md:px-0">
        <div className="wrapper">
          <div className="flex gap-2 md:gap-4 flex-wrap justify-center max-md:section-padding max-md:py-0">
            {news.tags.map((tag) => (
              <Tag active key={`news-tag-${tag.id}`}>
                {tag.title}
              </Tag>
            ))}
          </div>
          <NewsImageCarousel
            images={news.images}
            newsTitle={news.title}
            className="px-6 lg:max-w-3/4 mx-auto w-full max-lg:overflow-hidden"
          />
          <div className="lg:max-w-3/4 mx-auto w-full space-y-6 md:space-y-10 max-md:section-padding max-md:py-0">
            <p>{dayjs(news.date).format("LL")}</p>
            <h2 className="!mt-4">{news.title}</h2>
            <MarkdownRender source={news.text} className={cn("md:!text-lg")} />
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

      <NewsCarouselSection className="max-md:hidden" />
    </main>
  );
}

export default function News({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <NewsContent params={params} />
    </Suspense>
  );
}
