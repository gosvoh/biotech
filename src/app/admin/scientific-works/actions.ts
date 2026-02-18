"use server";

import { dbAction, requireAdmin } from "@/lib/utils.server";
import { prisma } from "@/prisma";
import type { ScientificWork } from "@/lib/db/client";

export async function addScientificWork(title: string) {
  await requireAdmin();
  return dbAction(prisma.scientificWork.create({ data: { title } }), [
    "scientificWorks",
    "members",
  ]);
}

export async function updateScientificWork(scientificWork: ScientificWork) {
  await requireAdmin();
  return dbAction(
    prisma.scientificWork.update({
      where: { id: scientificWork.id },
      data: scientificWork,
    }),
    ["scientificWorks", "members"]
  );
}

export async function deleteScientificWork(id: string) {
  await requireAdmin();
  return dbAction(prisma.scientificWork.delete({ where: { id } }), [
    "scientificWorks",
    "members",
  ]);
}
