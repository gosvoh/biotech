"use server";

import { actionResult, dbAction, requireAdmin } from "@/lib/utils.server";
import { prisma } from "@/prisma";
import type { Discipline } from "@/lib/db/client";

export async function addDiscipline(title: string) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(prisma.discipline.create({ data: { title } }), [
      "disciplines",
      "members",
    ]);
  });
}

export async function updateDiscipline(discipline: Discipline) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(
      prisma.discipline.update({
        where: { id: discipline.id },
        data: discipline,
      }),
      ["disciplines", "members"]
    );
  });
}

export async function deleteDiscipline(id: string) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(prisma.discipline.delete({ where: { id } }), [
      "disciplines",
      "members",
    ]);
  });
}
