"use client";

import { Checkbox } from "antd";
import { changeRole } from "./actions";
import { useTransition } from "react";
import { useAction } from "@/lib/use-action";

export default function IsAdmin({
  userId,
  role,
  canChangeRole,
}: {
  userId: string;
  role: string;
  canChangeRole: boolean;
}) {
  const runAction = useAction();
  const [pending, startTransition] = useTransition();

  return (
    <Checkbox
      checked={role === "admin"}
      disabled={!canChangeRole || pending}
      onChange={(e) =>
        startTransition(async () => {
          await runAction(
            changeRole(userId, e.target.checked ? "admin" : "user")
          );
        })
      }
    />
  );
}
