import { describe, expect, it } from "vitest";
import { getVkConfigStatus, readVkConfig } from "./config";

const secret = "fake-token-do-not-expose";

describe("VK server configuration", () => {
  it.each(["123", "-123", "biotech.itmo"])("accepts source %s independently of VK_APP_ID", (group) => {
    expect(readVkConfig({ VK_GROUP_ID: ` ${group} `, VK_GROUP_TOKEN: ` ${secret} `, VK_APP_ID: "ignored" }))
      .toEqual({ group, token: secret });
  });

  it.each([undefined, "", "0", "-0", "https://vk.com/example", "foo/bar", "x?access_token=secret", "123.4", "--123", "9007199254740992"])
    ("rejects invalid source %s without reflecting input", (group) => {
      expect(() => readVkConfig({ VK_GROUP_ID: group, VK_GROUP_TOKEN: secret })).toThrow(/VK_GROUP_ID/);
      expect(getVkConfigStatus({ VK_GROUP_ID: group, VK_GROUP_TOKEN: secret })).toMatchObject({ configured: false, source: null });
      expect(JSON.stringify(getVkConfigStatus({ VK_GROUP_ID: group, VK_GROUP_TOKEN: secret }))).not.toContain(secret);
    });

  it("reports missing token while keeping a valid public source visible", () => {
    expect(() => readVkConfig({ VK_GROUP_ID: "biotech.itmo" })).toThrow(/VK_GROUP_TOKEN/);
    expect(getVkConfigStatus({ VK_GROUP_ID: "biotech.itmo" })).toMatchObject({ configured: false, source: "biotech.itmo" });
  });

  it("returns configuration status without credentials", () => {
    expect(getVkConfigStatus({ VK_GROUP_ID: "123", VK_GROUP_TOKEN: secret }))
      .toEqual({ configured: true, source: "123", error: null });
    expect(JSON.stringify(getVkConfigStatus({ VK_GROUP_ID: "123", VK_GROUP_TOKEN: secret }))).not.toContain(secret);
  });
});
