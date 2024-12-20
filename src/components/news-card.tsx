import { cn } from "@/lib/utils";
import Image from "next/image";

export default function NewsCard({
  imageSrc,
  date,
  title,
  className,
  classNames,
}: {
  imageSrc?: React.ComponentProps<typeof Image>["src"];
  date: string;
  title: string;
  className?: string;
  classNames?: {
    root?: string;
    image?: string;
    date?: string;
    title?: string;
  };
}) {
  return (
    <div
      className={cn(
        "border border-border rounded-2.75xl p-10 space-y-6 w-full",
        "news-card-hover-effect",
        className,
        classNames?.root
      )}
    >
      {imageSrc && (
        <Image
          src={imageSrc}
          alt={`Изображение новости ${title}`}
          className={cn(
            "object-cover rounded-2.75xl aspect-square md:aspect-video w-full max-md:max-h-[300px]",
            classNames?.image
          )}
          width={385}
          height={240}
        />
      )}
      <div className="space-y-4">
        <p className={cn("text-brand3 text-xl", classNames?.date)}>{date}</p>
        <h3 className={cn("text-2xl text-accent-carbon", classNames?.title)}>
          {title}
        </h3>
      </div>
    </div>
  );
}
