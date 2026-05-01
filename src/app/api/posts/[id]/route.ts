import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const post = await prisma.post.update({
    where: { id: params.id },
    data: {
      title: body.title,
      body: body.body,
      color: body.color,
      imageUrl: body.imageUrl,
      linkUrl: body.linkUrl,
      linkTitle: body.linkTitle,
      linkDescription: body.linkDescription,
      linkImage: body.linkImage,
      author: body.author,
      section: body.section,
    },
  });
  return NextResponse.json(post);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.post.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
