"use server";

import { dbAction } from "@/lib/utils";
import type { Publication } from "@/lib/db/client";
import { prisma } from "@/prisma";

export async function createPublication(publication: Omit<Publication, "id">) {
  return dbAction(
    prisma.publication.create({ data: publication }),
    "publications"
  );
}

export async function updatePublication(publication: Publication) {
  return dbAction(
    prisma.publication.update({
      where: { id: publication.id },
      data: publication,
    }),
    "publications"
  );
}

export async function deletePublication(id: string) {
  return dbAction(prisma.publication.delete({ where: { id } }), "publications");
}
