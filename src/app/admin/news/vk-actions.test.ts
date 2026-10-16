import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { PrismaClient } from "@/lib/db/client";
import { createAuthTestClient } from "@/lib/auth-test-client";
const mocks = vi.hoisted(() => ({ db: null as unknown as PrismaClient, auth: vi.fn<() => Promise<{ user: { id?: string; role: string } } | null>>(async () => ({ user: { id: "suite-admin", role: "admin" } })), revalidateTag: vi.fn() }));
vi.mock("@/prisma", () => ({ get prisma() { return mocks.db; } }));
vi.mock("@/auth", () => ({ auth: mocks.auth, signIn: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
import { checkVkNewsPost, disableVkNewsSync, enableVkNewsSync, restoreVkNewsPost } from "./vk-actions";
import { deleteNews, changeVisibility, duplicateNews } from "./actions";
import { updateNews } from "./[id]/actions";
import { getNews } from "@/app/news/actions";

let directory: string;
let migrationState: { hidden: boolean; manuallyHidden: boolean; deleted: boolean };
let text: string;
const fetchMock = vi.fn<typeof fetch>();
const migration = "20261014120000_vk_editor_decisions";
const retryMigration = "20261014130000_vk_retry_generation";
function deploy() { execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", join(directory, "schema.prisma")], { env: { ...process.env, DATABASE_URL: `file:${join(directory, "test.db")}`, SHADOW_DATABASE_URL: `file:${join(directory, "shadow.db")}` }, stdio: "pipe" }); }
function response(data: unknown) { return new Response(JSON.stringify({ response: data })); }
function form(id = "news-id", title = "Ручная правка") {
  const values = new FormData();
  for (const [key, value] of Object.entries({ id, title, text: "Ручной текст", date: "2026-10-14", links: "{}", hidden: "false", tags: "science" })) values.set(key, value);
  return values;
}
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "biotech-vk-editor-action-")); writeFileSync(join(directory, "test.db"), ""); copyFileSync("schema.prisma", join(directory, "schema.prisma"));
  for (const entry of readdirSync("migrations")) if (entry !== migration && entry !== retryMigration) cpSync(join("migrations", entry), join(directory, "migrations", entry), { recursive: true });
  deploy(); mocks.db = createAuthTestClient(`file:${join(directory, "test.db")}`);
  await mocks.db.news.create({ data: { id: "legacy", title: "Старая скрытая", text: "Текст", links: "{}", date: "2026-09-01", hidden: true } });
  await mocks.db.$executeRawUnsafe(`INSERT INTO "VkImportSource" ("groupId","name","screenName") VALUES ('legacy','Группа','old.group')`);
  await mocks.db.$executeRawUnsafe(`INSERT INTO "VkImportPost" ("groupId","postId","newsId","status") VALUES ('legacy','1','legacy','imported'),('legacy','2',NULL,'imported')`);
  cpSync(join("migrations", migration), join(directory, "migrations", migration), { recursive: true }); cpSync(join("migrations", retryMigration), join(directory, "migrations", retryMigration), { recursive: true }); deploy();
  migrationState = { hidden: (await mocks.db.news.findUniqueOrThrow({ where: { id: "legacy" } })).hidden, manuallyHidden: (await mocks.db.vkImportPost.findUniqueOrThrow({ where: { groupId_postId: {groupId:"legacy",postId:"1"} } })).manualHidden, deleted: (await mocks.db.vkImportPost.findUniqueOrThrow({ where: { groupId_postId: {groupId:"legacy",postId:"2"} } })).manualDeleted };
}, 30000);
beforeEach(async () => {
  await mocks.db.user.upsert({ where: { id: "suite-admin" }, create: { id: "suite-admin", role: "admin", accessStatus: "active" }, update: { role: "admin", accessStatus: "active" } });
  await mocks.db.user.upsert({ where: { id: "suite-editor" }, create: { id: "suite-editor", role: "user", accessStatus: "active" }, update: { role: "user", accessStatus: "active" } });
  vi.clearAllMocks(); await mocks.db.vkImportPost.deleteMany(); await mocks.db.vkImportSource.deleteMany(); await mocks.db.news.deleteMany(); await mocks.db.newsTags.deleteMany();
  await mocks.db.newsTags.create({ data: { id: "science", title: "Наука", normalizedTitle: "наука" } });
  await mocks.db.vkImportSource.create({ data: { groupId: "42", name: "Биотех", screenName: "biotech.itmo" } });
  await mocks.db.news.create({ data: { id: "news-id", title: "Оригинал", text: "Оригинал #Наука", date: "2026-10-13", links: "{}", tags: { connect: { id: "science" } } } });
  await mocks.db.vkImportPost.create({ data: { groupId: "42", postId: "1", newsId: "news-id", status: "imported", selectionBasis: [{name:"наука",tagId:"science"}] } });
  mocks.auth.mockResolvedValue({user:{id:"suite-admin",role:"admin"}}); vi.stubEnv("DISABLE_ADMIN_AUTH","false"); vi.stubEnv("VK_GROUP_ID","biotech.itmo"); vi.stubEnv("VK_GROUP_TOKEN","test-token-no-output");
  text="Обновлённый оригинал #Наука"; vi.stubGlobal("fetch",fetchMock);
  fetchMock.mockImplementation(async (url) => {
    if(String(url).endsWith("groups.getById")) return response({groups:[{id:42,name:"Биотех",screen_name:"biotech.itmo"}]});
    const item={id:1,owner_id:-42,from_id:-42,date:Date.parse("2026-10-13T12:00:00Z")/1000,text,post_type:"post",attachments:[]};
    if(String(url).endsWith("wall.get")) return response({count:1,items:[item]});
    return response({items:[item]});
  });
});
afterAll(async () => { await mocks.db?.$disconnect(); if(directory && resolve(directory).startsWith(resolve(tmpdir(),"biotech-vk-editor-action-"))) rmSync(directory,{recursive:true,force:true}); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("authorized VK editor actions", () => {
  it("preserves previous manual hidden and deleted states through migration", () => { expect(migrationState).toEqual({hidden:true,manuallyHidden:true,deleted:true}); });
  it("blocks direct content editing while synchronization is enabled", async () => {
    expect(await updateNews(form())).toMatchObject({ok:false,error:expect.stringContaining("Отключите синхронизацию")});
    expect(await mocks.db.news.findUniqueOrThrow({where:{id:"news-id"}})).toMatchObject({title:"Оригинал"});
  });
  it("allows editing after disabling and preserves manual hiding through check and re-enable", async () => {
    expect((await disableVkNewsSync("news-id")).ok).toBe(true);
    expect((await changeVisibility("news-id",true)).ok).toBe(true);
    expect((await updateNews(form())).ok).toBe(true);
    expect((await checkVkNewsPost("news-id")).ok).toBe(true);
    expect(await mocks.db.news.findUniqueOrThrow({where:{id:"news-id"}})).toMatchObject({title:"Ручная правка",hidden:true});
    expect((await enableVkNewsSync("news-id")).ok).toBe(true);
    expect(await mocks.db.news.findUniqueOrThrow({where:{id:"news-id"}})).toMatchObject({title:"Обновлённый оригинал",hidden:true});
    expect((await getNews())[1]).toBe(0);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("news",{expire:0});
  });
  it("preserves deletion exclusion independently and restore does not promise publication", async () => {
    expect((await deleteNews("news-id")).ok).toBe(true);
    expect(await mocks.db.vkImportPost.findUniqueOrThrow({where:{groupId_postId:{groupId:"42",postId:"1"}}})).toMatchObject({newsId:null,manualDeleted:true});
    expect((await restoreVkNewsPost("42","1")).ok).toBe(true);
    expect(await mocks.db.news.count()).toBe(0);
    expect(await mocks.db.vkImportPost.findUniqueOrThrow({where:{groupId_postId:{groupId:"42",postId:"1"}}})).toMatchObject({manualDeleted:false,status:"pending"});
  });
  it("duplicates a linked news as a standalone hidden draft", async () => {
    const result=await duplicateNews("news-id"); expect(result.ok).toBe(true);
    expect(await mocks.db.news.count()).toBe(2); expect(await mocks.db.vkImportPost.count()).toBe(1);
    expect(await mocks.db.news.findFirstOrThrow({where:{id:{not:"news-id"}},include:{vkImport:true}})).toMatchObject({hidden:true,vkImport:null});
  });
  it.each(["check","enable","disable","restore","delete","hide","duplicate","edit"])("rejects non-admin %s before source or database mutation", async (operation) => {
    mocks.auth.mockResolvedValue({user:{id:"suite-editor",role:"user"}});
    const actions:Record<string,()=>Promise<{ok:boolean}>>={ check:()=>checkVkNewsPost("news-id"),enable:()=>enableVkNewsSync("news-id"),disable:()=>disableVkNewsSync("news-id"),restore:()=>restoreVkNewsPost("42","1"),delete:()=>deleteNews("news-id"),hide:()=>changeVisibility("news-id",true),duplicate:()=>duplicateNews("news-id"),edit:()=>updateNews(form()) };
    expect((await actions[operation]()).ok).toBe(false); expect(fetchMock).not.toHaveBeenCalled();
    expect(await mocks.db.news.count()).toBe(1); expect(await mocks.db.vkImportPost.findFirstOrThrow()).toMatchObject({syncEnabled:true,manualHidden:false,manualDeleted:false,revision:0});
  });
});
