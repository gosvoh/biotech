import { prisma } from "@/prisma";
import type { VkNewsState } from "./types";

// Called only after requireAdminPage. Do not send source snapshots to the client.
export async function getVkNewsState(newsId: string): Promise<VkNewsState | null> {
  const state = await prisma.vkImportPost.findUnique({ where: {newsId}, select: {groupId:true,postId:true,syncEnabled:true,manualHidden:true,manualDeleted:true,autoHiddenReason:true,lastCheckedAt:true,lastCheckError:true} });
  return state ? {...state,lastCheckedAt:state.lastCheckedAt?.toISOString() ?? null} : null;
}
export async function getExcludedVkPosts() {
  const posts = await prisma.vkImportPost.findMany({where:{manualDeleted:true},select:{groupId:true,postId:true,source:{select:{name:true}}},orderBy:[{groupId:"asc"},{postId:"desc"}]});
  return posts.map((post)=>({groupId:post.groupId,postId:post.postId,sourceName:post.source.name}));
}
