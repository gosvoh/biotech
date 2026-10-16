"use server";

import { requireAdminSection } from "@/lib/admin-access.server";

import { actionResult, dbAction } from "@/lib/utils.server";
import { prisma } from "@/prisma";
import { z } from "zod";

// Existing UI sends full records. Strip extra fields and allow scalar edits only.
const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
});

export async function addDiscipline(title: string) {
  return actionResult(async () => {
    await requireAdminSection("disciplines");
    await dbAction(prisma.discipline.create({ data: { title } }), [
      "disciplines",
      "members",
    ]);
  });
}

export async function updateDiscipline(input: unknown) {
  return actionResult(async () => {
    await requireAdminSection("disciplines");
    const { id, title } = updateSchema.parse(input);
    await dbAction(
      prisma.discipline.update({
        where: { id },
        data: { title },
      }),
      ["disciplines", "members"]
    );
  });
}

export async function deleteDiscipline(id: string) {
  return actionResult(async () => {
    await requireAdminSection("disciplines");
    await dbAction(prisma.discipline.delete({ where: { id } }), [
      "disciplines",
      "members",
    ]);
  });
}
