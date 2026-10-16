import { afterEach, expect, it, vi } from "vitest";
import { AuthError } from "next-auth";

const call = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ signIn: call }));
import { requestSignIn } from "./actions";
afterEach(() => { call.mockReset(); });
it("uses the common email sign-in flow and forces its destination", async () => {
  const data = new FormData();
  data.set("email", "Person@Example.test");
  data.set("redirectTo", "https://attacker.invalid");
  call.mockResolvedValue("http://localhost/api/auth/verify-request");
  expect(await requestSignIn({ submitted: false }, data)).toEqual({ submitted: true });
  expect(call).toHaveBeenCalledWith("nodemailer", { email: "Person@Example.test", redirect: false, redirectTo: "/admin" });
});
it("returns the same safe acknowledgement for authentication failures", async () => {
  const data = new FormData(); data.set("email", "unknown@example.test");
  call.mockRejectedValue(new AuthError("sensitive SMTP/token diagnostic"));
  expect(await requestSignIn({ submitted: false }, data)).toEqual({ submitted: true });
});
it("does not conceal non-auth programming failures", async () => {
  call.mockRejectedValue(new Error("implementation error"));
  await expect(requestSignIn({ submitted: false }, new FormData())).rejects.toThrow("implementation error");
});
