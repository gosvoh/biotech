"use server";

import { dbAction, requireAdmin } from "@/lib/utils.server";
import type { Publication } from "@/lib/db/client";
import { prisma } from "@/prisma";

export async function createPublication(publication: Omit<Publication, "id">) {
  await requireAdmin();
  return dbAction(
    prisma.publication.create({ data: publication }),
    "publications"
  );
}

export async function updatePublication(publication: Publication) {
  await requireAdmin();
  return dbAction(
    prisma.publication.update({
      where: { id: publication.id },
      data: publication,
    }),
    "publications"
  );
}

export async function deletePublication(id: string) {
  await requireAdmin();
  return dbAction(prisma.publication.delete({ where: { id } }), "publications");
}
