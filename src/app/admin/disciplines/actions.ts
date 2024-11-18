"use server";

import { dbAction } from "@/lib/utils";
import { prisma } from "@/prisma";
import type { Discipline } from "@/lib/db/client";

export async function addDiscipline(title: string) {
  return dbAction(prisma.discipline.create({ data: { title } }), "disciplines");
}

export async function updateDiscipline(discipline: Discipline) {
  return dbAction(
    prisma.discipline.update({
      where: { id: discipline.id },
      data: discipline,
    }),
    "disciplines"
  );
}

export async function deleteDiscipline(id: string) {
  return dbAction(prisma.discipline.delete({ where: { id } }), "disciplines");
}
