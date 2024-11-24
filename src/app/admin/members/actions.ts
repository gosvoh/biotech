"use server";

import { dbAction } from "@/lib/utils";
import { prisma } from "@/prisma";
import type { Member } from "@/lib/db/client";
import sharp from "sharp";
import fs from "fs/promises";
import parsePhoneNumber from "libphonenumber-js";

export async function addMember(formData: FormData) {
  const member: Omit<Member, "id" | "phone"> = {
    lastName: formData.get("lastName") as string,
    firstName: formData.get("firstName") as string,
    middleName: formData.get("middleName") as string,
    position: formData.get("position") as string,
    email: formData.get("email") as string,
    departmentId: formData.get("departmentId") as string,
  };
  const disciplinesStr = formData.get("disciplines") as string;
  const scientificWorksStr = formData.get("scientificWorks") as string;
  const disciplines = disciplinesStr ? disciplinesStr.split(",") : [];
  const scientificWorks = scientificWorksStr
    ? scientificWorksStr.split(",")
    : [];
  const image = formData.get("image") as File;
  const phone = formData.get("phone") as string | undefined;

  if (!member.lastName || !member.firstName || !image) {
    return Promise.reject("Please fill out the required fields.");
  }

  const phoneNumber = phone
    ? parsePhoneNumber(phone)?.formatInternational()
    : undefined;

  return dbAction(
    prisma.$transaction(async (prisma) => {
      const newMember = await prisma.member.create({
        data: {
          ...member,
          phone: phoneNumber,
          disciplines: { connect: disciplines.map((id) => ({ id })) },
          scientificWorks: { connect: scientificWorks.map((id) => ({ id })) },
        },
      });
      await fs.mkdir("uploads/members", { recursive: true });
      await sharp(await image.arrayBuffer()).toFile(
        `./uploads/members/${newMember.id}.webp`
      );
    }),
    "members"
  );
}

export async function updateMember(formData: FormData) {
  const member: Omit<Member, "phone"> = {
    id: formData.get("id") as string,
    lastName: formData.get("lastName") as string,
    firstName: formData.get("firstName") as string,
    middleName: formData.get("middleName") as string,
    position: formData.get("position") as string,
    email: formData.get("email") as string,
    departmentId: formData.get("departmentId") as string,
  };
  const disciplinesStr = formData.get("disciplines") as string;
  const scientificWorksStr = formData.get("scientificWorks") as string;
  const disciplines = disciplinesStr ? disciplinesStr.split(",") : [];
  const scientificWorks = scientificWorksStr
    ? scientificWorksStr.split(",")
    : [];
  const image = formData.get("image") as File;
  const phone = formData.get("phone") as string | undefined;

  if (!member.id || !member.lastName || !member.firstName) {
    return Promise.reject("Please fill out the required fields.");
  }

  const phoneNumber = phone
    ? parsePhoneNumber(phone)?.formatInternational()
    : undefined;

  console.log(phone, phoneNumber);

  return dbAction(
    prisma.$transaction(async (prisma) => {
      await prisma.member.update({
        where: { id: member.id },
        data: {
          ...member,
          phone: phoneNumber,
          disciplines: { set: disciplines.map((id) => ({ id })) },
          scientificWorks: { set: scientificWorks.map((id) => ({ id })) },
        },
      });
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
      await prisma.member.delete({ where: { id: memberId } });
      await fs.unlink(`uploads/members/${memberId}.webp`);
    }),
    "members"
  );
}

export async function duplicateMember(memberId: string) {
  return dbAction(
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
        "id" | "disciplines" | "scientificWorks"
      > = { ...member };
      delete memberToCreate.id;
      delete memberToCreate.disciplines;
      delete memberToCreate.scientificWorks;

      const newMember = await prisma.member.create({
        data: {
          ...memberToCreate,
          disciplines: { connect: disciplines.map((d) => ({ id: d.id })) },
          scientificWorks: {
            connect: scientificWorks.map((sw) => ({ id: sw.id })),
          },
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
