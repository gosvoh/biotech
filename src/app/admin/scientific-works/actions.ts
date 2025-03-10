"use server";

import { dbAction } from "@/lib/utils.server";
import { prisma } from "@/prisma";
import type { ScientificWork } from "@/lib/db/client";

export async function addScientificWork(title: string) {
  return dbAction(prisma.scientificWork.create({ data: { title } }), [
    "scientificWorks",
    "members",
  ]);
}

export async function updateScientificWork(scientificWork: ScientificWork) {
  return dbAction(
    prisma.scientificWork.update({
      where: { id: scientificWork.id },
      data: scientificWork,
    }),
    ["scientificWorks", "members"]
  );
}

export async function deleteScientificWork(id: string) {
  return dbAction(prisma.scientificWork.delete({ where: { id } }), [
    "scientificWorks",
    "members",
  ]);
}
