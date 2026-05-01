import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const folders = await prisma.folder.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { boards: true } } },
  });
  return NextResponse.json(folders);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const folder = await prisma.folder.create({ data: { name: body.name.trim() } });
  return NextResponse.json(folder, { status: 201 });
}
