"use client";
import { useState } from "react";
import { Button, Card, Popconfirm, Table } from "antd";
import { useRouter } from "next/navigation";
import { useAction } from "@/lib/use-action";
import { restoreVkNewsPost } from "./vk-actions";

export default function VkExclusions({posts}:{posts:{groupId:string;postId:string;sourceName:string}[]}) {
  const [pending,setPending]=useState(false); const run=useAction();const router=useRouter();
  if(!posts.length) return null;
  return <Card className="my-5" title="Исключённые посты ВК">
    <p className="mb-4 text-sm text-gray-600">Удаление новости сохраняет запрет повторного импорта. Восстановление снимает запрет, но не гарантирует публикацию: следующая проверка текущего источника загрузит только подходящий доступный оригинал.</p>
    <Table rowKey={(post)=>`${post.groupId}_${post.postId}`} dataSource={posts} pagination={{pageSize:10,hideOnSinglePage:true}} scroll={{x:450}} columns={[
      {title:"Оригинал",render:(_,post)=><a href={`https://vk.ru/wall-${post.groupId}_${post.postId}`} target="_blank" rel="noopener noreferrer">{post.sourceName} · пост {post.postId}</a>},
      {title:"Действие",width:160,render:(_,post)=><Popconfirm title="Снять запрет импорта этого поста?" description="Новость появится после проверки оригинала, если он доступен и подходит для импорта. Ручное скрытие сохраняется." okText="Снять запрет" cancelText="Отмена" disabled={pending} onConfirm={async()=>{setPending(true);try{await run(restoreVkNewsPost(post.groupId,post.postId),()=>router.refresh());}finally{setPending(false);}}}><Button disabled={pending}>Восстановить</Button></Popconfirm>},
    ]} />
  </Card>;
}
