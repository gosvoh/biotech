import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@/lib/db/client";
import { enableVkAutomation, disableVkAutomation, getVkAutomationState, tickVkAutomation, checkVkLatest } from "./automation";
import { importVkNews } from "./importer";
import type { VkApi, VkPost } from "./types";
let directory: string, db: PrismaClient;
let clock = new Date("2026-10-14T12:00:00Z"), posts: VkPost[] = [], calls = 0;
const group = { id: "123", name: "Science", screenName: "science" };
const api: VkApi = { getGroup: async () => group, getWall: async (_, offset, count) => { calls++; return { items: posts.slice(offset, offset + count), count: posts.length }; }, getPosts: async (_, ids) => posts.filter(p => ids.includes(p.id)) };
const options = () => ({ db, api, images: { prepare: async () => [], discard: async () => { } }, invalidate: () => { }, now: () => clock, currentGroupId: group.id });
const post = (id: number, date: number): VkPost => ({ id: String(id), ownerId: "-123", fromId: "-123", date, text: `News ${id} #Science`, isRepost: false, isPinned: false, postType: "post", photos: [] });
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "vk-auto-"));
  writeFileSync(join(directory, "test.db"), "");
  copyFileSync("schema.prisma", join(directory, "schema.prisma"));
  for (const entry of readdirSync("migrations"))
    cpSync(join("migrations", entry), join(directory, "migrations", entry), { recursive: true });
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", join(directory, "schema.prisma")], { env: { ...process.env, DATABASE_URL: `file:${join(directory, "test.db")}`, SHADOW_DATABASE_URL: `file:${join(directory, "shadow.db")}` }, stdio: "pipe" });
  db = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
}, 30000);
beforeEach(async () => { await db.vkImportSource.deleteMany(); await db.vkAutomationRuntime.deleteMany(); await db.news.deleteMany(); await db.newsTags.deleteMany(); await db.newsTags.create({ data: { title: "Science", normalizedTitle: "science" } }); clock = new Date("2026-10-14T12:00:00Z"); posts = []; calls = 0; });
afterAll(async () => {
  await db?.$disconnect();
  if (directory && resolve(directory).startsWith(resolve(tmpdir(), "vk-auto-")))
    rmSync(directory, { recursive: true, force: true });
});
it("starts OFF, probes before enabling and initializes the cursor at initial queue creation", async () => {
  expect(await getVkAutomationState(db, "123")).toMatchObject({ enabled: false });
  await tickVkAutomation(options());
  expect(calls).toBe(0);
  const state = await enableVkAutomation(options());
  expect(state).toMatchObject({ enabled: true, initialState: { state: "queued" } });
  const saved = await db.vkImportSource.findUniqueOrThrow({ where: { groupId: "123" } });
  expect(saved.cursorDate).toBe(Math.floor(clock.getTime() / 1000));
  await disableVkAutomation(db, "123");
  clock = new Date(clock.getTime() + 86400000);
  expect((await enableVkAutomation(options())).initialHistoryId).toBe(state.initialHistoryId);
  expect((await db.vkImportSource.findUniqueOrThrow({ where: { groupId: "123" } })).cursorDate).toBe(saved.cursorDate);
});
it("catches more than thirty posts after a pause and persists intervals across restart", async () => {
  await enableVkAutomation(options());
  const boundary = Math.floor(clock.getTime() / 1000);
  await disableVkAutomation(db, "123");
  clock = new Date(clock.getTime() + 86400000);
  posts = Array.from({ length: 41 }, (_, i) => post(41 - i, boundary + 41 - i));
  await enableVkAutomation(options());
  const other = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
  try {
    const state = await tickVkAutomation({ ...options(), db: other });
    expect(await db.news.count()).toBe(41);
    expect(state.lastNewAt).toBe(clock.toISOString());
    const before = calls;
    await tickVkAutomation(options());
    expect(calls - before).toBeLessThanOrEqual(1);
  }
  finally {
    await other.$disconnect();
  }
});
it("failed access does not enable or overwrite success", async () => {
  await expect(enableVkAutomation({ ...options(), api: { ...api, getWall: async () => { throw new Error("secret-token"); } } })).rejects.toThrow();
  expect(await getVkAutomationState(db, "123")).toMatchObject({ enabled: false, lastNewAt: null });
  await enableVkAutomation(options());
  await tickVkAutomation(options());
  const success = (await getVkAutomationState(db, "123")).lastNewAt;
  clock = new Date(clock.getTime() + 900000);
  await tickVkAutomation({ ...options(), api: { ...api, getWall: async () => { throw new Error("secret-token"); } } });
  expect(await getVkAutomationState(db, "123")).toMatchObject({ lastNewAt: success });
  expect(JSON.stringify(await getVkAutomationState(db, "123"))).not.toContain("secret-token");
});
it("disable during photo I/O fences publication and immediately permits manual import", async () => {
  await enableVkAutomation(options());
  posts = [post(1, Math.floor(clock.getTime() / 1000) + 1)];
  let paused!: () => void, resume!: () => void;
  const entered = new Promise<void>(r => paused = r), held = new Promise<void>(r => resume = r);
  const running = tickVkAutomation({ ...options(), images: { prepare: async () => { paused(); await held; return []; }, discard: async () => { } } });
  await entered;
  await disableVkAutomation(db, "123");
  expect((await db.vkImportSource.findUniqueOrThrow({ where: { groupId: "123" } })).leaseToken).toBeNull();
  expect((await importVkNews(options())).successful).toBe(true);
  resume();
  await running;
  expect(await db.news.count()).toBe(1);
});
it("changing the configured source requires its own explicit enable", async () => {
  await enableVkAutomation(options());
  await tickVkAutomation({ ...options(), currentGroupId: "456", api: { ...api, getGroup: async () => ({ ...group, id: "456" }) } });
  expect(await getVkAutomationState(db, "456")).toMatchObject({ enabled: false, lastNewAt: null });
  expect(await getVkAutomationState(db, "123")).toMatchObject({ enabled: false });
});
it("SIGTERM or a changed env fences an in-flight automatic owner and releases its source lease", async () => {
  for (const mode of ["signal", "source"]) {
    await enableVkAutomation(options());
    posts = [post(mode === "signal" ? 8 : 9, Math.floor(clock.getTime() / 1000) + 5)];
    const controller = new AbortController();
    let current = true, entered!: () => void, release!: () => void;
    const started = new Promise<void>(r => entered = r), held = new Promise<void>(r => release = r);
    const work = tickVkAutomation({ ...options(), signal: controller.signal, isCurrentSource: () => current, images: { prepare: async () => { entered(); await held; return []; }, discard: async () => { } } });
    await started;
    if (mode === "signal")
      controller.abort();
    else
      current = false;
    release();
    await work;
    expect(await db.news.count()).toBe(0);
    expect((await db.vkImportSource.findUniqueOrThrow({ where: { groupId: "123" } })).leaseToken).toBeNull();
    clock = new Date(clock.getTime() + 900000);
  }
});
it("two restarted workers cannot dispatch the same due operations while manual work shares the fence", async () => {
  await enableVkAutomation(options());
  posts = [post(55, Math.floor(clock.getTime() / 1000) + 1)];
  const second = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "test.db")}` } } });
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(r => entered = r), held = new Promise<void>(r => release = r);
  try {
    const work = tickVkAutomation({ ...options(), images: { prepare: async () => { entered(); await held; return []; }, discard: async () => { } } });
    await started;
    expect((await tickVkAutomation({ ...options(), db: second })).running).toBe(true);
    expect((await importVkNews({ ...options(), db: second })).successful).toBe(false);
    release();
    await work;
    expect(await db.news.count()).toBe(1);
  }
  finally {
    release?.();
    await second.$disconnect();
  }
});
it("new and daily checks keep independent controlled-time deadlines while initial errors retry", async () => {
  await enableVkAutomation(options());
  await tickVkAutomation(options());
  const first = await getVkAutomationState(db, "123");
  expect(first).toMatchObject({ lastNewAt: clock.toISOString(), lastSyncAt: clock.toISOString() });
  clock = new Date(clock.getTime() + 899000);
  await tickVkAutomation(options());
  expect((await getVkAutomationState(db, "123")).lastNewAt).toBe(first.lastNewAt);
  clock = new Date(clock.getTime() + 1000);
  await tickVkAutomation(options());
  const next = await getVkAutomationState(db, "123");
  expect(next.lastNewAt).toBe(clock.toISOString());
  expect(next.lastSyncAt).toBe(first.lastSyncAt);
  clock = new Date(clock.getTime() + 86400000);
  await tickVkAutomation(options());
  expect((await getVkAutomationState(db, "123")).lastSyncAt).toBe(clock.toISOString());
});
it("history retries are fair and do not prevent due new posts", async () => {
  const { queueVkHistory } = await import("./history");
  await enableVkAutomation(options());
  const older = await queueVkHistory(options(), { from: "2026-09-01", to: "2026-09-01" });
  posts = [post(33, Math.floor(clock.getTime() / 1000) + 5)];
  await tickVkAutomation(options());
  expect(await db.news.count()).toBe(1);
  const initial = (await getVkAutomationState(db, "123")).initialHistoryId!;
  clock = new Date(clock.getTime() + 1000);
  await tickVkAutomation(options());
  expect((await db.vkHistoryJob.findUniqueOrThrow({ where: { id: initial } })).state).toBe("completed");
  expect((await db.vkHistoryJob.findUniqueOrThrow({ where: { id: older.id } })).state).toBe("completed");
});
it("successful manual checks move the next scheduled deadlines without replaying immediately", async () => {
  await enableVkAutomation(options());
  await tickVkAutomation(options());
  clock = new Date(clock.getTime() + 800000);
  await importVkNews(options());
  const success = clock.toISOString();
  clock = new Date(clock.getTime() + 100000);
  await tickVkAutomation(options());
  expect((await getVkAutomationState(db, "123")).lastNewAt).toBe(success);
});
it("a dispatcher that loses its durable ownership cannot publish or release its replacement", async () => {
  await enableVkAutomation(options());
  posts = [post(77, Math.floor(clock.getTime() / 1000) + 1)];
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(r => entered = r), held = new Promise<void>(r => release = r);
  const work = tickVkAutomation({ ...options(), images: { prepare: async () => { entered(); await held; return []; }, discard: async () => { } } });
  await started;
  await db.vkAutomationRuntime.update({ where: { id: 1 }, data: { leaseToken: "replacement", leaseUntil: new Date(clock.getTime() + 300000) } });
  release();
  await work;
  expect(await db.news.count()).toBe(0);
  expect((await db.vkAutomationRuntime.findUniqueOrThrow({ where: { id: 1 } })).leaseToken).toBe("replacement");
});
it("missing config heartbeats detach the source without exposing its enabled or running state", async () => {
  const { heartbeatVkWorker } = await import("./automation");
  await enableVkAutomation(options());
  await heartbeatVkWorker(db, { currentGroupId: null, error: "ВК не подключён", now: () => clock });
  expect(await getVkAutomationState(db, null)).toMatchObject({ enabled: false, groupId: null, running: false, error: "ВК не подключён", lastWorkerAt: clock.toISOString() });
  expect(await getVkAutomationState(db, "123")).toMatchObject({ enabled: false });
});
it("a failing manual history cannot monopolize all later history jobs", async () => {
  const { queueVkHistory } = await import("./history");
  await enableVkAutomation(options());
  posts = [post(1, Date.parse("2026-09-01T09:00:00Z") / 1000)];
  const manual = await queueVkHistory(options(), { from: "2026-09-01", to: "2026-09-01" });
  const failing = { ...options(), images: { prepare: async () => { throw new Error("bad photo"); }, discard: async () => { } } };
  await tickVkAutomation(failing);
  clock = new Date(clock.getTime() + 60000);
  await tickVkAutomation(options());
  expect((await db.vkHistoryJob.findUniqueOrThrow({ where: { id: manual.id } })).state).toBe("completed");
});
it("a pause arriving during an enable probe wins over that stale enable request", async () => {
  await enableVkAutomation(options());
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(r => entered = r), held = new Promise<void>(r => release = r);
  const enabling = enableVkAutomation({ ...options(), api: { ...api, getWall: async () => { entered(); await held; return { items: [], count: 0 }; } } });
  await started;
  await disableVkAutomation(db, "123");
  release();
  await expect(enabling).rejects.toThrow();
  expect(await getVkAutomationState(db, "123")).toMatchObject({ enabled: false });
});
it("heals cache after committed publication while automation is OFF and retries failed invalidation", async () => {
  const { healVkRevalidation } = await import("./automation");
  await db.vkImportSource.create({ data: { groupId: "123", name: "Science", screenName: "science", needsRevalidate: true, revalidationRevision: 7 } });
  await db.news.create({ data: { title: "Committed before pause", text: "Content", hidden: false, links: "", date: clock.toISOString() } });
  expect(await healVkRevalidation(db, async () => { throw new Error("private-cache-secret"); })).toBe(false);
  expect((await db.vkImportSource.findUniqueOrThrow({ where: { groupId: "123" } })).needsRevalidate).toBe(true);
  expect(await healVkRevalidation(db, () => {})).toBe(true);
  expect((await db.vkImportSource.findUniqueOrThrow({ where: { groupId: "123" } })).needsRevalidate).toBe(false);
  expect(await db.news.count()).toBe(1);
  expect(await getVkAutomationState(db, "123")).toMatchObject({ enabled: false });
});
it("cache healing preserves a newer publication generation while clearing other completed generations", async () => {
  const { healVkRevalidation } = await import("./automation");
  await db.vkImportSource.createMany({ data: [
    { groupId: "123", name: "Science", screenName: "science", needsRevalidate: true, revalidationRevision: 7 },
    { groupId: "456", name: "Old source", screenName: "old", needsRevalidate: true, revalidationRevision: 2 },
  ] });
  expect(await healVkRevalidation(db, async () => {
    await db.vkImportSource.update({ where: { groupId: "123" }, data: { revalidationRevision: { increment: 1 } } });
  })).toBe(true);
  expect((await db.vkImportSource.findUniqueOrThrow({ where: { groupId: "123" } })).needsRevalidate).toBe(true);
  expect((await db.vkImportSource.findUniqueOrThrow({ where: { groupId: "456" } })).needsRevalidate).toBe(false);
  expect(await healVkRevalidation(db, () => {})).toBe(true);
  expect((await db.vkImportSource.findUniqueOrThrow({ where: { groupId: "123" } })).needsRevalidate).toBe(false);
  expect(calls).toBe(0);
});

it("persists an ordinary manual check behind history and drains it after restart with automation OFF",async()=>{
 const {queueVkHistory,runVkHistoryBatch}=await import("./history");
 const date=Date.parse("2026-09-02T09:00:00Z")/1000;
 posts=[post(1,date)];
 const history=await queueVkHistory(options(),{from:"2026-09-01",to:"2026-10-14"});
 let entered!:()=>void,release!:()=>void;
 const started=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve);
 const historical=runVkHistoryBatch({...options(),images:{prepare:async()=>{entered();await held;return[];},discard:async()=>{}}},history.id);
 try{
  await started;
  expect(await checkVkLatest(options())).toMatchObject({successful:false,queued:true});
  expect(await getVkAutomationState(db,"123")).toMatchObject({enabled:false,manualCheckPending:true,queued:true});
 }finally{release();await historical;}
 posts=[post(2,date+100),{...post(1,date),text:"Edited existing #Science"}];
 clock=new Date(clock.getTime()+60000);
 const restarted=new PrismaClient({datasources:{db:{url:`file:${join(directory,"test.db")}`}}});
 try{
  expect(await tickVkAutomation({...options(),db:restarted})).toMatchObject({enabled:false,manualCheckPending:false,queued:false});
  expect(await db.news.count()).toBe(2);
  expect(await db.news.findFirst({where:{title:"Edited existing"}})).toMatchObject({hidden:false});
  const source=await db.vkImportSource.findUniqueOrThrow({where:{groupId:"123"}});
  expect(source.lastSuccessAt).toEqual(clock);expect(source.lastSyncAt).toEqual(clock);
  const prior=calls;await tickVkAutomation({...options(),db:restarted});expect(calls).toBe(prior);expect(await db.news.count()).toBe(2);
 }finally{await restarted.$disconnect();}
});
it("does not consume a newer manual request arriving during a check already in flight",async()=>{
 posts=[post(1,Math.floor(clock.getTime()/1000))];
 let entered!:()=>void,release!:()=>void;
 const started=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve);
 const running=checkVkLatest({...options(),images:{prepare:async()=>{entered();await held;return[];},discard:async()=>{}}});
 try{
  await started;
  expect(await checkVkLatest(options())).toMatchObject({queued:true});
 }finally{release();}
 expect(await running).toMatchObject({successful:true,queued:false});
 expect(await getVkAutomationState(db,"123")).toMatchObject({manualCheckPending:true,queued:true});
 clock=new Date(clock.getTime()+1000);await tickVkAutomation(options());
 expect(await getVkAutomationState(db,"123")).toMatchObject({enabled:false,manualCheckPending:false,queued:false});
 expect(await db.news.count()).toBe(1);
});
it("keeps a manual request pending until both new and synchronization checks succeed and throttles retries",async()=>{
 let rejectFirst=true;
 const failing={...options(),api:{...api,getWall:async(id:string,offset:number,count:number)=>{calls++;if(rejectFirst){rejectFirst=false;throw new Error("private-token");}return{items:posts.slice(offset,offset+count),count:posts.length};}}};
 const result=await checkVkLatest(failing);
 expect(result).toMatchObject({successful:false,queued:true,sync:{successful:true}});
 expect(JSON.stringify(result)).not.toContain("private-token");
 expect(await getVkAutomationState(db,"123")).toMatchObject({manualCheckPending:true});
 const prior=calls;await tickVkAutomation(options());expect(calls).toBe(prior);
 clock=new Date(clock.getTime()+60000);await tickVkAutomation(options());
 expect(await getVkAutomationState(db,"123")).toMatchObject({manualCheckPending:false});
});
it("fences an in-flight manual queue on a source change without borrowing the old source request",async()=>{
 posts=[post(1,Math.floor(clock.getTime()/1000))];let current=true;
 let entered!:()=>void,release!:()=>void;
 const started=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve);
 const running=checkVkLatest({...options(),isCurrentSource:()=>current,images:{prepare:async()=>{entered();await held;return[];},discard:async()=>{}}});
 await started;current=false;release();expect(await running).toMatchObject({successful:false,queued:true});
 expect(await db.news.count()).toBe(0);
 const state=await tickVkAutomation({...options(),currentGroupId:"456",api:{...api,getGroup:async()=>({...group,id:"456"})}});
 expect(state).toMatchObject({groupId:"456",enabled:false,manualCheckPending:false,queued:false});
 expect(await getVkAutomationState(db,"123")).toMatchObject({manualCheckPending:true});
 expect(await db.news.count()).toBe(0);
});
