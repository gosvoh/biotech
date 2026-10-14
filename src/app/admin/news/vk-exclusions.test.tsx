// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App, ConfigProvider } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import VkExclusions from "./vk-exclusions";
import { restoreVkNewsPost } from "./vk-actions";
vi.mock("./vk-actions",()=>({restoreVkNewsPost:vi.fn(async()=>({ok:true}))}));
const refresh=vi.fn(); vi.mock("next/navigation",()=>({useRouter:()=>({refresh})}));
let root:Root;let container:HTMLDivElement;
beforeEach(async()=>{vi.clearAllMocks();vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true); vi.stubGlobal("ResizeObserver",class {observe(){} unobserve(){} disconnect(){}}); vi.stubGlobal("matchMedia",(media:string)=>({media,matches:false,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return true;}})); const computed=window.getComputedStyle.bind(window);vi.spyOn(window,"getComputedStyle").mockImplementation((element)=>computed(element));container=document.createElement("div");document.body.append(container);root=createRoot(container);await act(async()=>root.render(<ConfigProvider theme={{token:{motion:false}}}><App><VkExclusions posts={[{groupId:"42",postId:"1",sourceName:"Биотех"}]} /></App></ConfigProvider>));});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
it("explains that restoring a manual exclusion does not promise publication and requires confirmation",async()=>{
  expect(container.textContent).toContain("не гарантирует публикацию");
  await act(async()=>container.querySelector<HTMLButtonElement>("button")!.click());
  expect(restoreVkNewsPost).not.toHaveBeenCalled();
  await act(async()=>[...document.querySelectorAll<HTMLButtonElement>("button")].find((item)=>item.textContent?.includes("Снять запрет"))!.click());
  expect(restoreVkNewsPost).toHaveBeenCalledWith("42","1");expect(refresh).toHaveBeenCalledOnce();
});
