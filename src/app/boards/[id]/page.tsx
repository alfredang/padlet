import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Heart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import BoardClient from "@/components/BoardClient";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: { id: string } }) {
  const board = await prisma.board.findUnique({
    where: { id: params.id },
    include: { posts: { orderBy: { createdAt: "desc" } } },
  });
  if (!board) notFound();

  let sections: string[] | null = null;
  if (board.sectionsJson) {
    try {
      const parsed = JSON.parse(board.sectionsJson);
      if (Array.isArray(parsed)) sections = parsed.filter((s) => typeof s === "string");
    } catch {}
  }

  return (
    <main className="min-h-screen" style={{ background: board.background }}>
      <header className="border-b border-black/5 bg-white/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-slate-600 hover:text-violet-600 text-sm font-semibold"
          >
            <ArrowLeft size={16} /> Boards
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight truncate">{board.title}</h1>
              {board.isFavourite && (
                <Heart size={16} className="text-rose-500 fill-rose-500 shrink-0" />
              )}
            </div>
            {board.description && (
              <p className="text-sm text-slate-600 truncate">{board.description}</p>
            )}
          </div>
          <span className="hidden sm:inline-block text-xs text-slate-600 capitalize bg-white/80 px-2.5 py-1 rounded-full font-medium">
            {board.layout}
          </span>
        </div>
      </header>

      <BoardClient
        boardId={board.id}
        layout={board.layout}
        sections={sections}
        initialPosts={board.posts.map((p) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          color: p.color,
          imageUrl: p.imageUrl,
          linkUrl: p.linkUrl,
          linkTitle: p.linkTitle,
          linkDescription: p.linkDescription,
          linkImage: p.linkImage,
          author: p.author,
          section: p.section,
          createdAt: p.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
