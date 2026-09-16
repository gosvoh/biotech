import { generateOGImage } from "@/lib/meta";
import { getMember } from "./page";
import { notFound } from "next/navigation";

export const alt = "Команда";
export const size = {
  width: 1920,
  height: 960,
};

export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const member = await getMember((await params).id);

  if (!member) return notFound();

  return generateOGImage(
    `Команда: ${[member.firstName, member.middleName, member.lastName].join(
      " "
    )}`,
    { fontSize: 100 }
  );
}
