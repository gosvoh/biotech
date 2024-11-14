"use client";

import { Checkbox } from "antd";
import { changeRole } from "./actions";
import { useFormStatus } from "react-dom";

export default function IsAdmin({
  userId,
  role,
  canChangeRole,
}: {
  userId: string;
  role: string;
  canChangeRole: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Checkbox
      checked={role === "admin"}
      disabled={!canChangeRole || pending}
      onChange={(e) => changeRole(userId, e.target.checked ? "admin" : "user")}
    />
  );
}
