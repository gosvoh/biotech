import { cn } from "@/lib/utils";
import Image from "next/image";

export default function NewsCard({
  imageSrc,
  date,
  title,
  className,
}: {
  imageSrc: React.ComponentProps<typeof Image>["src"];
  date: string;
  title: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border border-border rounded-2.75xl p-10 space-y-6 w-full",
        className
      )}
    >
      <Image
        src={imageSrc}
        alt={`Изображение новости ${title}`}
        className="object-cover rounded-2.75xl aspect-square md:aspect-video w-full max-md:max-h-[300px]"
        width={385}
        height={240}
      />
      <div className="space-y-4">
        <p className="text-brand3 text-xl">{date}</p>
        <h3 className="text-2xl text-accent-carbon">{title}</h3>
      </div>
    </div>
  );
}
