import { createRequire } from "node:module";
import type { PrismaClient as PrismaClientType } from "../src/lib/db/client";
// Keep the generated client and its native engine outside the portable worker bundle.
const { PrismaClient } = createRequire(import.meta.url)("../src/lib/db/client") as { PrismaClient: typeof PrismaClientType };
import { createVkApi, getVkApiErrorMessage } from "../src/lib/vk-import/client";
import { getVkConfigStatus, readVkConfig } from "../src/lib/vk-import/config";
import { createVkImageStore } from "../src/lib/vk-import/images";
import { createNewsPhotoFiles } from "../src/lib/vk-import/news-files";
import { heartbeatVkWorker, healVkRevalidation, tickVkAutomation } from "../src/lib/vk-import/automation";
import { createWorkerCache } from "../src/lib/vk-import/worker-cache";
import { runVkWorker } from "../src/lib/vk-import/worker-runtime";

const db=new PrismaClient();
const stop=new AbortController();
const shutdown=()=>stop.abort();
const message=(value:unknown)=>{if(value&&typeof value==="object"&&"type"in value&&value.type==="shutdown")shutdown();};
process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);process.on("message",message);
process.on("disconnect",shutdown);
try {
 const cache=createWorkerCache({port:Number(process.env.PORT??3000),secret:process.env.REVALIDATE_SECRET??""});
 const images=createVkImageStore();const removeOldImages=createNewsPhotoFiles().remove;
 await runVkWorker({signal:stop.signal,flush:async()=>{
  try {
   await cache.flush();
   if(!await healVkRevalidation(db,cache.invalidate))throw new Error();
  } catch {
   const error="Новости сохранены, но кеш не обновлён. Исполнитель повторит обновление автоматически.";
   await heartbeatVkWorker(db,{error});
   throw new Error(error);
  }
 },disconnect:()=>db.$disconnect(),onError:()=>console.warn("[vk-worker] Не удалось выполнить фоновую проверку; повтор будет выполнен автоматически."),tick:async()=>{
  const configured=getVkConfigStatus();
  // Losing credentials pauses work; only a different configured group revokes its source.
  // Resolve known identities locally before validating the token, without contacting VK.
  const group=configured.source;
  const numeric=group&&/^-?\d+$/.test(group)?String(Math.abs(Number(group))):null;
  let source=numeric??(group?(await db.vkImportSource.findMany({select:{groupId:true,screenName:true}})).find(item=>item.screenName.toLowerCase()===group.toLowerCase())?.groupId:undefined);
  if(!configured.configured||!group){await heartbeatVkWorker(db,{currentGroupId:source??null,error:configured.error??"ВК не подключён."});return false;}
  const config=readVkConfig();
  // A screen name needs explicit editor access before it has a verified canonical identity.
  // With automatic import off and no queued work, startup must not contact VK.
  if(!source){
   const catalog=await db.vkImportTagCatalog.findUnique({where:{id:1}});
   if(catalog&&catalog.revision>0){try{source=(await createVkApi(config).getGroup()).id;}catch(error){await heartbeatVkWorker(db,{currentGroupId:null,error:getVkApiErrorMessage(error)});return false;}}
   else{await heartbeatVkWorker(db,{currentGroupId:null,error:null});return false;}
  }
  await heartbeatVkWorker(db,{currentGroupId:source,error:null});
  const state=await tickVkAutomation({db,api:createVkApi(config),images,removeOldImages,invalidate:cache.invalidate,currentGroupId:source,signal:stop.signal,isCurrentSource:()=>getVkConfigStatus().source===configured.source});
  return state.queued&&!state.error;
 }});
} catch { console.error("[vk-worker] Исполнитель ВК остановлен из-за ошибки настроек или базы данных."); await db.$disconnect();process.exitCode=1; }
finally {process.off("SIGINT",shutdown);process.off("SIGTERM",shutdown);process.off("message",message);process.off("disconnect",shutdown);process.disconnect?.();}
