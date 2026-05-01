import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTemplate } from "@/lib/templates";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.templateId) {
    return NextResponse.json({ error: "templateId required" }, { status: 400 });
  }
  const template = getTemplate(body.templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const board = await prisma.board.create({
    data: {
      title: body.title?.trim() || template.name,
      description: template.description,
      background: template.background,
      layout: template.layout,
      sectionsJson: template.sections ? JSON.stringify(template.sections) : null,
      folderId: body.folderId ?? null,
      posts: {
        create: template.posts.map((p) => ({
          title: p.title ?? null,
          body: p.body,
          color: p.color ?? "#fffbeb",
          linkUrl: p.linkUrl ?? null,
          imageUrl: p.imageUrl ?? null,
          author: p.author ?? null,
          section: p.section ?? null,
        })),
      },
    },
  });

  return NextResponse.json(board, { status: 201 });
}
