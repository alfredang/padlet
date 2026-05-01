import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.boardId || !body?.body) {
    return NextResponse.json({ error: "boardId and body are required" }, { status: 400 });
  }
  const post = await prisma.post.create({
    data: {
      boardId: body.boardId,
      title: body.title ?? null,
      body: body.body,
      color: body.color ?? "#fffbeb",
      imageUrl: body.imageUrl ?? null,
      linkUrl: body.linkUrl ?? null,
      linkTitle: body.linkTitle ?? null,
      linkDescription: body.linkDescription ?? null,
      linkImage: body.linkImage ?? null,
      author: body.author ?? null,
      section: body.section ?? null,
    },
  });
  await prisma.board.update({ where: { id: body.boardId }, data: { updatedAt: new Date() } });
  return NextResponse.json(post, { status: 201 });
}
