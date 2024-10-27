import { generateOGImage } from "@/lib/meta";

export const runtime = "edge";

export const alt = "Главная";
export const size = {
  width: 1920,
  height: 960,
};

export const contentType = "image/png";

export default async function Image() {
  return generateOGImage(alt, {
    color: "hsl(156, 99%, 41%)",
    fontSize: 200,
    textAlign: "center",
    outline: "2px solid red",
    alignSelf: "center",
    margin: 0,
  });
}
