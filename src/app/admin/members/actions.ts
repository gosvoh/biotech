"use server";

import {
  actionResult,
  dbAction,
  getOptionalString,
  requireAdmin,
} from "@/lib/utils.server";
import { prisma } from "@/prisma";
import type { Member } from "@/lib/db/client";
import fs from "fs/promises";
import parsePhoneNumber from "libphonenumber-js";
import { randomUUID } from "crypto";
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v.length ? v : null))
  .nullable();

const memberSchema = z.object({
  lastName: z.string().trim().min(1, "Please fill out the required fields."),
  firstName: z.string().trim().min(1, "Please fill out the required fields."),
  middleName: optionalText,
  position: optionalText,
  email: optionalText.refine(
    (v) => v === null || z.email().safeParse(v).success,
    { message: "Invalid email." }
  ),
  departmentId: optionalText,
});

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseMemberForm(formData: FormData) {
  return memberSchema.safeParse({
    lastName: getFormString(formData, "lastName"),
    firstName: getFormString(formData, "firstName"),
    middleName: getFormString(formData, "middleName"),
    position: getFormString(formData, "position"),
    email: getFormString(formData, "email"),
    departmentId: getFormString(formData, "departmentId"),
  });
}

function getMemberImageKey(member: Pick<Member, "id" | "image">) {
  return member.image ?? member.id;
}

function getMemberImagePath(imageKey: string) {
  return `uploads/members/${imageKey}.webp`;
}

async function saveMemberImage(image: File, imageKey: string) {
  await fs.mkdir("uploads/members", { recursive: true });
  // The client crop modal (member-image-crop.ts) always emits a square image,
  // so fitting it into a 1000x1000 box without upscaling reproduces the old
  // sharp `fit: cover` output. Bun.Image has no native addon / libvips, so it
  // survives the `output: "standalone"` build that broke sharp's runtime
  // dlopen of libvips-cpp.so on the server.
  await new Bun.Image(await image.arrayBuffer())
    .resize(1000, 1000, { withoutEnlargement: true })
    .webp()
    .write(getMemberImagePath(imageKey));
}

export async function addMember(formData: FormData) {
  return actionResult(async () => {
    await requireAdmin();

    const parsed = parseMemberForm(formData);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const member: Omit<
      Member,
      "id" | "phone" | "image" | "createdAt" | "updatedAt"
    > = parsed.data;

    const disciplinesStr = getFormString(formData, "disciplines");
    const scientificWorksStr = getFormString(formData, "scientificWorks");
    const disciplines = disciplinesStr ? disciplinesStr.split(",") : [];
    const scientificWorks = scientificWorksStr
      ? scientificWorksStr.split(",")
      : [];
    const image = formData.get("image");
    const phone = getOptionalString(formData.get("phone"));

    if (!(image instanceof File) || image.size === 0) {
      throw new Error("Please fill out the required fields.");
    }

    const phoneNumber = phone
      ? parsePhoneNumber(phone)?.formatInternational()
      : null;

    await dbAction(
      prisma.$transaction(async (prisma) => {
        const imageKey = randomUUID();

        const newMember = await prisma.member.create({
          data: {
            ...member,
            image: imageKey,
            phone: phoneNumber,
            disciplines: { connect: disciplines.map((id) => ({ id })) },
            scientificWorks: { connect: scientificWorks.map((id) => ({ id })) },
          },
        });

        await saveMemberImage(image, newMember.image ?? newMember.id);
      }),
      "members"
    );
  });
}

export async function updateMember(formData: FormData) {
  return actionResult(async () => {
    await requireAdmin();

    const id = formData.get("id");
    if (typeof id !== "string" || !id) {
      throw new Error("Please fill out the required fields.");
    }
    const parsed = parseMemberForm(formData);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const member: Omit<Member, "phone" | "image" | "createdAt" | "updatedAt"> =
      {
        id,
        ...parsed.data,
      };

    const disciplinesStr = getFormString(formData, "disciplines");
    const scientificWorksStr = getFormString(formData, "scientificWorks");
    const disciplines = disciplinesStr ? disciplinesStr.split(",") : [];
    const scientificWorks = scientificWorksStr
      ? scientificWorksStr.split(",")
      : [];
    const image = formData.get("image") as File;
    const phone = getOptionalString(formData.get("phone"));

    const phoneNumber = phone
      ? parsePhoneNumber(phone)?.formatInternational()
      : null;

    await dbAction(
      prisma.$transaction(async (prisma) => {
        const currentMember = await prisma.member.findUnique({
          where: { id: member.id },
          select: { id: true, image: true },
        });

        if (!currentMember) throw new Error("Member not found");

        const currentImageKey = getMemberImageKey(currentMember);
        const nextImageKey = image ? randomUUID() : undefined;
        const { id: memberId, ...memberData } = member;

        await prisma.member.update({
          where: { id: memberId },
          data: {
            ...memberData,
            ...(nextImageKey ? { image: nextImageKey } : {}),
            phone: phoneNumber,
            disciplines: { set: disciplines.map((id) => ({ id })) },
            scientificWorks: { set: scientificWorks.map((id) => ({ id })) },
          },
        });

        if (image && nextImageKey) {
          await saveMemberImage(image, nextImageKey);
          await fs
            .unlink(getMemberImagePath(currentImageKey))
            .catch(() => null);
        }
      }),
      "members"
    );
  });
}

export async function deleteMember(memberId: string) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(
      prisma.$transaction(async (prisma) => {
        const member = await prisma.member.findUnique({
          where: { id: memberId },
          select: { id: true, image: true },
        });

        if (!member) throw new Error("Member not found");

        await prisma.member.delete({ where: { id: memberId } });
        await fs
          .unlink(getMemberImagePath(getMemberImageKey(member)))
          .catch(() => null);
      }),
      "members"
    );
  });
}

export async function duplicateMember(memberId: string) {
  return actionResult(async () => {
    await requireAdmin();
    await dbAction(
      prisma.$transaction(async (prisma) => {
        const member = await prisma.member.findUnique({
          where: { id: memberId },
          include: { disciplines: true, scientificWorks: true },
        });
        if (!member) {
          throw new Error("Member not found");
        }

        const disciplines = member.disciplines;
        const scientificWorks = member.scientificWorks;

        const memberToCreate: Optional<
          typeof member,
          "id" | "image" | "disciplines" | "scientificWorks"
        > = { ...member };
        delete memberToCreate.id;
        delete memberToCreate.image;
        delete memberToCreate.disciplines;
        delete memberToCreate.scientificWorks;

        const sourceImageKey = getMemberImageKey(member);
        const newImageKey = randomUUID();

        const newMember = await prisma.member.create({
          data: {
            ...memberToCreate,
            image: newImageKey,
            disciplines: { connect: disciplines.map((d) => ({ id: d.id })) },
            scientificWorks: {
              connect: scientificWorks.map((sw) => ({ id: sw.id })),
            },
          },
        });
        await fs.copyFile(
          getMemberImagePath(sourceImageKey),
          getMemberImagePath(newMember.image ?? newMember.id)
        );
      }),
      "members"
    );
  });
}
