// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App, ConfigProvider } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import NewsClient from "./page.client";
import type { VkNewsState } from "@/lib/vk-import/types";
vi.mock("./actions",()=>({addNews:vi.fn(),updateNews:vi.fn()}));
vi.mock("../actions",()=>({duplicateNews:vi.fn(),changeVisibility:vi.fn()}));
vi.mock("../vk-actions",()=>({checkVkNewsPost:vi.fn(),enableVkNewsSync:vi.fn(),disableVkNewsSync:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
let root:Root;let container:HTMLDivElement;
const state:VkNewsState={groupId:"42",postId:"1",syncEnabled:true,manualHidden:false,manualDeleted:false,autoHiddenReason:null,lastCheckedAt:null,lastCheckError:null};
const dates={createdAt:new Date(0),updatedAt:new Date(0)};
const tags=[{id:"science",title:"Наука",normalizedTitle:"наука",...dates}];
const news={id:"news-id",title:"Оригинал",text:"Текст #Наука",date:"2026-10-13",hidden:false,links:'{"vkLink":"https://vk.ru/wall-42_1"}',tags,images:[],...dates};
async function render(syncEnabled:boolean){await act(async()=>root.render(<ConfigProvider theme={{token:{motion:false}}}><App><NewsClient news={news} tags={tags} vkState={{...state,syncEnabled}} /></App></ConfigProvider>));}
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("ResizeObserver",class {observe(){}unobserve(){}disconnect(){}});vi.stubGlobal("matchMedia",(media:string)=>({media,matches:false,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return true;}}));const computed=window.getComputedStyle.bind(window);vi.spyOn(window,"getComputedStyle").mockImplementation((element)=>computed(element));container=document.createElement("div");document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
it("locks actual form fields and markdown while synced, then allows independent editing",async()=>{
  await render(true);
  expect([...container.querySelectorAll("button")].filter((button)=>button.textContent?.includes("Создать самостоятельную копию"))).toHaveLength(1);
  expect([...container.querySelectorAll("a")].filter((link)=>link.textContent?.includes("Оригинал новости в ВК"))).toHaveLength(1);
  expect(container.querySelector<HTMLInputElement>('input[id="title"]')?.disabled).toBe(true);
  expect(container.querySelector<HTMLTextAreaElement>("textarea")?.readOnly).toBe(true);
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  await render(false);
  expect(container.querySelector<HTMLInputElement>('input[id="title"]')?.disabled).toBe(false);
  expect(container.querySelector<HTMLTextAreaElement>("textarea")?.readOnly).toBe(false);
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
});
