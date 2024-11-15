"use server";

import { dbAction } from "@/lib/utils";
import { prisma } from "@/prisma";
import type { Member } from "@/lib/db/client";
import sharp from "sharp";
import fs from "fs/promises";

export async function addMember(formData: FormData) {
  const member: Omit<Member, "id"> = {
    lastName: formData.get("lastName") as string,
    firstName: formData.get("firstName") as string,
    middleName: formData.get("middleName") as string,
    position: formData.get("position") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    departmentId: formData.get("departmentId") as string,
  };
  const image = formData.get("image") as File;

  if (!member.lastName || !member.firstName || !image) {
    return Promise.reject("Please fill out the required fields.");
  }

  return dbAction(
    prisma.$transaction(async (prisma) => {
      const newMember = await prisma.member.create({ data: member });
      await fs.mkdir("uploads/members", { recursive: true });
      await sharp(await image.arrayBuffer()).toFile(
        `./uploads/members/${newMember.id}.webp`
      );
    }),
    "members"
  );
}

export async function updateMember(formData: FormData) {
  const member: Member = {
    id: formData.get("id") as string,
    lastName: formData.get("lastName") as string,
    firstName: formData.get("firstName") as string,
    middleName: formData.get("middleName") as string,
    position: formData.get("position") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    departmentId: formData.get("departmentId") as string,
  };
  const image = formData.get("image") as File;

  if (!member.id || !member.lastName || !member.firstName) {
    return Promise.reject("Please fill out the required fields.");
  }

  return dbAction(
    prisma.$transaction(async (prisma) => {
      await prisma.member.update({ where: { id: member.id }, data: member });
      if (image) {
        await sharp(await image.arrayBuffer())
          .resize(200, 200)
          .toFile(`uploads/members/${member.id}.webp`);
      }
    }),
    "members"
  );
}

export async function deleteMember(memberId: string) {
  return dbAction(
    prisma.$transaction(async (prisma) => {
      const member = await prisma.member.delete({ where: { id: memberId } });
      await fs.unlink(`uploads/members/${member.id}.webp`);
    }),
    "members"
  );
}

export async function duplicateMember(memberId: string) {
  return dbAction(
    prisma.$transaction(async (prisma) => {
      const member = await prisma.member.findUnique({
        where: { id: memberId },
      });
      if (!member) {
        throw new Error("Member not found");
      }
      const newMember = await prisma.member.create({
        data: {
          ...member,
          id: undefined,
        },
      });
      await fs.copyFile(
        `uploads/members/${member.id}.webp`,
        `uploads/members/${newMember.id}.webp`
      );
    }),
    "members"
  );
}
