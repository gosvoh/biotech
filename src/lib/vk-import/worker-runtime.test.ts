import { expect, it, vi } from "vitest";
import { runVkWorker } from "./worker-runtime";
it("drains an active batch before disconnecting and never starts another after shutdown",async()=>{
 const stop=new AbortController(); const events:string[]=[];
 let release!:()=>void, entered!:()=>void;
 const held=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);
 const running=runVkWorker({signal:stop.signal,tick:async()=>{events.push("batch");entered();await held;events.push("saved");return false;},flush:async()=>{},disconnect:async()=>{events.push("disconnected");}});
 await started;stop.abort(); expect(events).toEqual(["batch"]);release();await running;expect(events).toEqual(["batch","saved","disconnected"]);
});
it("runs queued batches without overlapping and recovers after a failed iteration",async()=>{
 vi.useFakeTimers();const stop=new AbortController();const events:string[]=[];let count=0;
 const running=runVkWorker({signal:stop.signal,pollMs:100,queuedPollMs:10,tick:async()=>{events.push(`batch${++count}`);if(count===1)throw new Error("private token");return count===2;},flush:async()=>{},disconnect:async()=>{},onError:()=>events.push("safe error")});
 await vi.advanceTimersByTimeAsync(100);expect(events).toEqual(["batch1","safe error","batch2"]);
 await vi.advanceTimersByTimeAsync(10);expect(events).toEqual(["batch1","safe error","batch2","batch3"]);
 stop.abort();await running;vi.useRealTimers();
});
it("retries cache recovery before starting another import batch",async()=>{
 vi.useFakeTimers();const stop=new AbortController();const events:string[]=[];let attempts=0;
 const running=runVkWorker({signal:stop.signal,pollMs:100,flush:async()=>{events.push(`cache${++attempts}`);if(attempts===1)throw new Error("private transport data");},tick:async()=>{events.push("batch");return false;},disconnect:async()=>{},onError:()=>events.push("safe error")});
 await vi.advanceTimersByTimeAsync(0);expect(events).toEqual(["cache1","safe error"]);
 await vi.advanceTimersByTimeAsync(100);expect(events).toEqual(["cache1","safe error","cache2","batch"]);
 stop.abort();await running;vi.useRealTimers();
});
