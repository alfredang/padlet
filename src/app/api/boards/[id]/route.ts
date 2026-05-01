import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const board = await prisma.board.findUnique({
    where: { id: params.id },
    include: { posts: { orderBy: { createdAt: "desc" } } },
  });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(board);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const board = await prisma.board.update({
    where: { id: params.id },
    data: {
      title: body.title,
      description: body.description,
      background: body.background,
      layout: body.layout,
      isTrashed: body.isTrashed,
      isFavourite: body.isFavourite,
      folderId: body.folderId,
    },
  });
  return NextResponse.json(board);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "1";
  if (hard) {
    await prisma.board.delete({ where: { id: params.id } });
  } else {
    await prisma.board.update({ where: { id: params.id }, data: { isTrashed: true } });
  }
  return new NextResponse(null, { status: 204 });
}
