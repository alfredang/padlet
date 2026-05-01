import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const folder = await prisma.folder.update({ where: { id: params.id }, data: { name: body.name } });
  return NextResponse.json(folder);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.folder.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
