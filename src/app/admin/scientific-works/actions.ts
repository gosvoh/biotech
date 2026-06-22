"use server";

import { actionResult, dbAction, requireAdmin } from "@/lib/utils.server";
import { prisma } from "@/prisma";
import type { ScientificWork } from "@/lib/db/client";

export async function addScientificWork(title: string) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(prisma.scientificWork.create({ data: { title } }), [
      "scientificWorks",
      "members",
    ]);
  });
}

export async function updateScientificWork(scientificWork: ScientificWork) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(
      prisma.scientificWork.update({
        where: { id: scientificWork.id },
        data: scientificWork,
      }),
      ["scientificWorks", "members"]
    );
  });
}

export async function deleteScientificWork(id: string) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(prisma.scientificWork.delete({ where: { id } }), [
      "scientificWorks",
      "members",
    ]);
  });
}
