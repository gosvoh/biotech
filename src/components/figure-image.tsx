import Image from "next/image";
import Landing from "@public/landing.png";
import Landing1 from "@public/landing1.webp";
import Landing2 from "@public/landing2.webp";
import { cn } from "@/lib/utils";
import Reveal from "./reveal";

export default function FigureImage({ className }: { className?: string }) {
  return (
    <Reveal className={cn("relative", className)}>
      <Image
        src={Landing1}
        alt=""
        className="absolute top-0 left-0 rounded-full aspect-square object-cover max-w-11/40"
      />
      <Image
        src={Landing2}
        alt=""
        className="absolute bottom-0 right-0 rounded-full aspect-square object-cover max-w-11/40"
      />
      <Image src={Landing} alt="" priority />
    </Reveal>
  );
}
