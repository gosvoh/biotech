import { unstable_cache as cache } from "next/cache";

const getMemberData = cache(
  async (id: number) => {
    const res = await fetch(`https://api.example.com/members/${id}`);
    return res.json();
  },
  ["members"],
  { revalidate: 3600, tags: ["members"] }
);

export default async function Member({
  params,
}: {
  params: Promise<{ id: number }>;
}) {
  //   const member = await getMemberData((await params).id);

  return <>MEMBER</>;
}
