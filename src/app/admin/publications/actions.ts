"use server";

import { actionResult, dbAction, requireAdmin } from "@/lib/utils.server";
import type { Publication } from "@/lib/db/client";
import { prisma } from "@/prisma";

export async function createPublication(publication: Omit<Publication, "id">) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(
      prisma.publication.create({ data: publication }),
      "publications"
    );
  });
}

export async function updatePublication(publication: Publication) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(
      prisma.publication.update({
        where: { id: publication.id },
        data: publication,
      }),
      "publications"
    );
  });
}

export async function deletePublication(id: string) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(
      prisma.publication.delete({ where: { id } }),
      "publications"
    );
  });
}
