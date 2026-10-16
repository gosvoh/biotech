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

export async function addScientificWork(title: string) {
  return actionResult(async () => {
    await requireAdminSection("scientific-works");
    await dbAction(prisma.scientificWork.create({ data: { title } }), [
      "scientificWorks",
      "members",
    ]);
  });
}

export async function updateScientificWork(input: unknown) {
  return actionResult(async () => {
    await requireAdminSection("scientific-works");
    const { id, title } = updateSchema.parse(input);
    await dbAction(
      prisma.scientificWork.update({
        where: { id },
        data: { title },
      }),
      ["scientificWorks", "members"]
    );
  });
}

export async function deleteScientificWork(id: string) {
  return actionResult(async () => {
    await requireAdminSection("scientific-works");
    await dbAction(prisma.scientificWork.delete({ where: { id } }), [
      "scientificWorks",
      "members",
    ]);
  });
}
