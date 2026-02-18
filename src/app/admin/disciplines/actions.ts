"use server";

import { dbAction, requireAdmin } from "@/lib/utils.server";
import { prisma } from "@/prisma";
import type { Discipline } from "@/lib/db/client";

export async function addDiscipline(title: string) {
  await requireAdmin();
  return dbAction(prisma.discipline.create({ data: { title } }), [
    "disciplines",
    "members",
  ]);
}

export async function updateDiscipline(discipline: Discipline) {
  await requireAdmin();
  return dbAction(
    prisma.discipline.update({
      where: { id: discipline.id },
      data: discipline,
    }),
    ["disciplines", "members"]
  );
}

export async function deleteDiscipline(id: string) {
  await requireAdmin();
  return dbAction(prisma.discipline.delete({ where: { id } }), [
    "disciplines",
    "members",
  ]);
}
