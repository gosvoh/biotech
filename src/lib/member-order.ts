import type { Prisma } from "@/lib/db/client";

// Shared by the public page and admin list; ties remain deterministic.
export const memberOrderBy = [
  { sortOrder: "asc" },
  { lastName: "asc" },
  { firstName: "asc" },
  { id: "asc" },
] satisfies Prisma.MemberOrderByWithRelationInput[];

// Call inside the same transaction as the create or department change.
export async function nextMemberSortOrder(
  tx: Prisma.TransactionClient,
  departmentId: string | null,
) {
  const { _max } = await tx.member.aggregate({
    where: { departmentId },
    _max: { sortOrder: true },
  });
  return (_max.sortOrder ?? -1) + 1;
}
