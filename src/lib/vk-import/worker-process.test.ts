import { afterEach, expect, it } from "vitest";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { runtimeEnvironment, webCommand } from "../../../scripts/start-with-vk";
import { PrismaClient } from "@/lib/db/client";
const resources: {directory:string;child:ChildProcess}[]=[];
afterEach(()=>{for(const {directory,child} of resources.splice(0)){child.kill();if(resolve(directory).startsWith(resolve(tmpdir(),"vk-process-")))rmSync(directory,{recursive:true,force:true});}});
const waitFor=async(check:()=>boolean)=>{const deadline=Date.now()+8000;while(!check()){if(Date.now()>deadline)throw new Error("Process fixture timed out");await new Promise(r=>setTimeout(r,20));}};
async function fixture(crash=false){
 const directory=mkdtempSync(join(tmpdir(),"vk-process-"));const events=join(directory,"events.txt"),stopFile=join(directory,"stop");
 const server=createServer();await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));const port=(server.address() as {port:number}).port;await new Promise<void>(r=>server.close(()=>r()));
 const web=join(directory,"web.ts"),worker=join(directory,"worker.ts"),parent=join(directory,"parent.ts");
 writeFileSync(web,`import {appendFileSync} from 'node:fs'; const log=(s)=>appendFileSync(${JSON.stringify(events)},s+'\\n'); Bun.serve({hostname:'127.0.0.1',port:Number(process.env.PORT),fetch(req){if(req.headers.get('x-revalidate-secret')!==process.env.REVALIDATE_SECRET)return new Response('',{status:401});log('invalidated');return new Response('ok');}});log('web');`);
 writeFileSync(worker,`import {appendFileSync} from 'node:fs';import {runVkWorker} from ${JSON.stringify(resolve("src/lib/vk-import/worker-runtime.ts"))}; const log=(s)=>appendFileSync(${JSON.stringify(events)},s+'\\n'); const stop=new AbortController();process.on('message',m=>{if(m.type==='shutdown'){log('shutdown');stop.abort();}});await runVkWorker({signal:stop.signal,pollMs:20,tick:async()=>{try{const r=await fetch('http://127.0.0.1:'+process.env.PORT+'/api/internal/revalidate',{method:'POST',headers:{'x-revalidate-secret':process.env.REVALIDATE_SECRET}});if(r.ok){log('batch');${crash?"process.exit(7);":"await Bun.sleep(100);log('drained');"}}}catch{}return false;},flush:async()=>{},disconnect:async()=>log('disconnected')});process.disconnect?.();`);
 writeFileSync(parent,`import {existsSync} from 'node:fs';import {runtimeEnvironment,superviseApplication} from ${JSON.stringify(resolve("scripts/start-with-vk.ts"))};const stop=new AbortController();const timer=setInterval(()=>{if(existsSync(${JSON.stringify(stopFile)}))stop.abort();},10);const env=runtimeEnvironment(['--port',${JSON.stringify(String(port))}],{...process.env,PORT:'3000',REVALIDATE_SECRET:''});process.exitCode=await superviseApplication({web:[process.execPath,${JSON.stringify(web)}],worker:[process.execPath,${JSON.stringify(worker)}],env,signal:stop.signal,shutdownMs:1000});clearInterval(timer);`);
 const child=spawn("bun",[parent],{cwd:process.cwd(),env:{...process.env,VK_GROUP_TOKEN:"",VK_GROUP_ID:"",DATABASE_URL:"file:unused"},stdio:["ignore","pipe","pipe"]});resources.push({directory,child});let output="";child.stdout?.on("data",x=>output+=x);child.stderr?.on("data",x=>output+=x);
 const exited=new Promise<number|null>((r,j)=>{child.on("exit",r);child.on("error",j);});
 const log=()=>existsSync(events)?readFileSync(events,"utf8"):"";
 return {child,log,stop:()=>writeFileSync(stopFile,""),exited,output:()=>output,port};
}
it("shares the forwarded port and ephemeral cache secret, then drains the worker and stops both child processes",async()=>{
 const app=await fixture();await waitFor(()=>app.log().includes("batch"));app.stop();expect(await app.exited).toBe(0);expect(app.log()).toContain("invalidated");expect(app.log()).toContain("shutdown");expect(app.log()).toContain("disconnected");
 expect(app.log().indexOf("disconnected")).toBeGreaterThan(app.log().indexOf("drained"));
 await expect(fetch(`http://127.0.0.1:${app.port}`)).rejects.toThrow();
},12000);
it("stops the web process when the worker exits unexpectedly",async()=>{
 const app=await fixture(true);expect(await app.exited).toBe(7);expect(app.log()).toContain("invalidated");await expect(fetch(`http://127.0.0.1:${app.port}`)).rejects.toThrow();
},12000);
it("preserves an explicit cache secret and rejects an invalid forwarded port",()=>{
 expect(runtimeEnvironment(["--port=3028"],{PORT:"3000",REVALIDATE_SECRET:"existing"})).toMatchObject({PORT:"3028",REVALIDATE_SECRET:"existing"});
 expect(()=>runtimeEnvironment(["-p","0"],{})).toThrow();expect(()=>runtimeEnvironment(["-p","65536"],{})).toThrow();
 expect(runtimeEnvironment([],{}).REVALIDATE_SECRET?.length).toBeGreaterThan(32);
});


it("preserves enabled automation and paused history when a compiled worker temporarily lacks only its token",async()=>{
 const directory=mkdtempSync(join(tmpdir(),"vk-process-token-"));
 const database=`file:${join(directory,"test.db")}`;
 const db=new PrismaClient({datasources:{db:{url:database}}});
 let child:ChildProcess|undefined,exited:Promise<number|null>|undefined;
 const stopFile=join(directory,"stop"),parent=join(directory,"parent.ts");
 try {
  writeFileSync(join(directory,"test.db"),"");copyFileSync("schema.prisma",join(directory,"schema.prisma"));cpSync("migrations",join(directory,"migrations"),{recursive:true});
  execFileSync(process.execPath,[resolve("node_modules/prisma/build/index.js"),"migrate","deploy","--schema",join(directory,"schema.prisma")],{env:{...process.env,DATABASE_URL:database,SHADOW_DATABASE_URL:`file:${join(directory,"shadow.db")}`},stdio:"pipe"});
  execFileSync("bun",["scripts/build-vk-worker.ts"],{stdio:"pipe"});
  await db.vkImportSource.create({data:{groupId:"42",name:"Science",screenName:"science",autoEnabled:true,autoRevision:4,cursorDate:1770000000}});
  await db.vkHistoryJob.create({data:{id:"initial-42",groupId:"42",initialKey:"42",initial:true,from:"2026-09-01",to:"2026-10-14",state:"waiting",scanOffset:100}});
  writeFileSync(parent,`import {existsSync} from 'node:fs';const worker=Bun.spawn([process.execPath,${JSON.stringify(resolve(".next/vk-worker.js"))}],{env:process.env,stdin:'ignore',stdout:'inherit',stderr:'inherit',ipc(){}});let stopping=false;const timer=setInterval(()=>{if(!stopping&&existsSync(${JSON.stringify(stopFile)})){stopping=true;worker.send({type:'shutdown'});}},10);process.exitCode=await worker.exited;clearInterval(timer);`);
  // Both a numeric ID and a stored alias must identify the same source without API access.
  // A genuinely new unresolved alias still revokes the previous automatic source.
  for(const entry of [{group:"42",expectedSource:"42",enabled:true},{group:"SCIENCE",expectedSource:"42",enabled:true},{group:"another",expectedSource:null,enabled:false}]){
   await db.vkImportSource.update({where:{groupId:"42"},data:{autoEnabled:true,autoRevision:4}});
   await db.vkAutomationRuntime.upsert({where:{id:1},create:{id:1,currentGroupId:"42"},update:{currentGroupId:"42",lastWorkerAt:null,lastError:null}});
   if(existsSync(stopFile))rmSync(stopFile);
   child=spawn("bun",[parent],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:database,VK_GROUP_ID:entry.group,VK_GROUP_TOKEN:"",REVALIDATE_SECRET:"test-worker-only",PORT:"3028"},stdio:["ignore","pipe","pipe"]});
   child.stdout?.resume();child.stderr?.resume();
   exited=new Promise<number|null>((resolve,reject)=>{child!.once("exit",resolve);child!.once("error",reject);});
   const deadline=Date.now()+5000;
   let runtime=await db.vkAutomationRuntime.findUniqueOrThrow({where:{id:1}});
   while(!runtime.lastWorkerAt&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,20));runtime=await db.vkAutomationRuntime.findUniqueOrThrow({where:{id:1}});}
   expect(runtime.lastWorkerAt).not.toBeNull();expect(runtime.lastError).toBeTruthy();expect(runtime.currentGroupId).toBe(entry.expectedSource);
   const saved=await db.vkImportSource.findUniqueOrThrow({where:{groupId:"42"}});
   expect(saved.autoEnabled).toBe(entry.enabled);expect(saved.cursorDate).toBe(1770000000);
   if(entry.enabled)expect(saved.autoRevision).toBe(4);
   expect(await db.vkHistoryJob.findUnique({where:{id:"initial-42"}})).toMatchObject({initialKey:"42",state:"waiting",scanOffset:100});
   writeFileSync(stopFile,"");expect(await exited).toBe(0);child=undefined;exited=undefined;
  }
 }finally{
  if(child&&exited){writeFileSync(stopFile,"");await Promise.race([exited,new Promise<void>(resolve=>setTimeout(resolve,1000))]);if(child.exitCode===null){child.kill();await exited;}}
  await db.$disconnect();if(resolve(directory).startsWith(resolve(tmpdir(),"vk-process-token-")))rmSync(directory,{recursive:true,force:true});
 }
},15000);

it.each(["--webpack","--turbopack","--turbo"])("honors an explicit dev bundler %s while forwarding the selected port",(bundler)=>{
 expect(webCommand("dev",[bundler,"--port","3028"]).slice(3)).toEqual(["dev",bundler,"--port","3028"]);
});
it("uses Webpack for local dev and leaves production startup arguments intact",()=>{
 expect(webCommand("dev",["--port","3028"]).slice(3)).toEqual(["dev","--webpack","--port","3028"]);
 expect(webCommand("start",["-p","3028"]).slice(3)).toEqual(["start","-p","3028"]);
 expect(webCommand("standalone",["bun","./server.js"])).toEqual(["bun","./server.js"]);
});
