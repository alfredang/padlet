import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const view = url.searchParams.get("view");
  const folderId = url.searchParams.get("folderId");

  const where: any = { isTrashed: false };
  if (view === "trashed") where.isTrashed = true;
  if (view === "favourites") where.isFavourite = true;
  if (folderId) where.folderId = folderId;

  const boards = await prisma.board.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { posts: true } } },
  });
  return NextResponse.json(boards);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const board = await prisma.board.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      background: body.background ?? "#fef3c7",
      layout: body.layout ?? "grid",
      sectionsJson: body.sections ? JSON.stringify(body.sections) : null,
      folderId: body.folderId ?? null,
    },
  });
  return NextResponse.json(board, { status: 201 });
}
