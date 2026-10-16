import { describe, expect, it } from "vitest";
import {
  ADMIN_ACCESS_BUNDLES, ADMIN_SECTIONS, canManageSection, getAdminLanding,
  getAdminSectionForPath, isFullAdmin, type AdminAccess,
} from "./admin-access";

const user = (overrides: Partial<AdminAccess> = {}): AdminAccess => ({
  userId: "editor", role: "user", status: "active", sections: [], ...overrides,
});

describe("admin section access", () => {
  it("grants active full administrators all five sections and a non-looping landing", () => {
    const access = user({ role: "admin" });
    expect(isFullAdmin(access)).toBe(true);
    for (const section of ["members", "disciplines", "scientific-works", "news", "publications"]) {
      expect(canManageSection(access, section)).toBe(true);
    }
    expect(getAdminLanding(access)).toBe("/admin/news");
  });

  it("fails closed for unknown section codes even for full administrators", () => {
    for (const section of ["team", "users", "tags", "NEWS", "", "toString", "__proto__"]) {
      expect(canManageSection(user({ role: "admin" }), section)).toBe(false);
      expect(canManageSection(user({ sections: [section as never] }), section)).toBe(false);
    }
  });

  it.each(["pending", "blocked", "ACTIVE", "unknown"])("denies status %s including administrators", (status) => {
    const access = user({ role: "admin", status: status as AdminAccess["status"], sections: ["news"] });
    expect(isFullAdmin(access)).toBe(false);
    for (const section of ADMIN_SECTIONS) expect(canManageSection(access, section.code)).toBe(false);
    expect(getAdminLanding(access)).toBe("/admin");
  });

  it.each(["owner", "ADMIN", "", "toString"])("denies unknown role %s", (role) => {
    const access = user({ role: role as AdminAccess["role"], sections: ["news"] });
    expect(isFullAdmin(access)).toBe(false);
    expect(canManageSection(access, "news")).toBe(false);
    expect(getAdminLanding(access)).toBe("/admin");
  });

  it("maps news and tags including nested pages to the same permission with path boundaries", () => {
    for (const path of ["/admin/news", "/admin/news/new", "/admin/news/123", "/admin/tags", "/admin/tags/123"]) {
      expect(getAdminSectionForPath(path)).toBe("news");
      expect(canManageSection(user({ sections: ["news"] }), getAdminSectionForPath(path)!)).toBe(true);
    }
    expect(getAdminSectionForPath("/admin/members/123")).toBe("members");
    expect(getAdminSectionForPath("/admin/disciplines")).toBe("disciplines");
    expect(getAdminSectionForPath("/admin/scientific-works")).toBe("scientific-works");
    expect(getAdminSectionForPath("/admin/publications")).toBe("publications");
    for (const path of ["/admin", "/admin/users", "/admin/newsroom", "/admin/tags-other", "/news"]) {
      expect(getAdminSectionForPath(path)).toBeNull();
    }
  });

  it("grants only selected bundle sections and selects a stable catalog landing", () => {
    const news = user({ sections: [...ADMIN_ACCESS_BUNDLES.news.sections] });
    expect(canManageSection(news, "news")).toBe(true);
    expect(canManageSection(news, "members")).toBe(false);
    expect(getAdminLanding(news)).toBe("/admin/news");
    const team = user({ sections: [...ADMIN_ACCESS_BUNDLES.team.sections] });
    for (const section of ["members", "disciplines", "scientific-works"]) expect(canManageSection(team, section)).toBe(true);
    expect(canManageSection(team, "news")).toBe(false);
    expect(canManageSection(team, "publications")).toBe(false);
    expect(getAdminLanding(team)).toBe("/admin/members");
    expect(getAdminLanding(user({ sections: ["news", "publications", "disciplines"] }))).toBe("/admin/disciplines");
    expect(getAdminLanding(user({ sections: ["publications"] }))).toBe("/admin/publications");
  });

  it("keeps an active user without assigned access on the no-access dashboard", () => {
    expect(getAdminLanding(user())).toBe("/admin");
    expect(isFullAdmin(user())).toBe(false);
    expect(canManageSection(user(), "news")).toBe(false);
  });
});
