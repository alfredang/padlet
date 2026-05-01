import { prisma } from "@/lib/prisma";
import BoardGrid from "@/components/BoardGrid";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function FavouritesPage() {
  const boards = await prisma.board.findMany({
    where: { isTrashed: false, isFavourite: true },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { posts: true } } },
  });

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Favourites"
        subtitle="Your most-loved boards"
        accent="rose"
      />
      <BoardGrid
        variant="favourites"
        boards={boards.map((b) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          background: b.background,
          layout: b.layout,
          isFavourite: b.isFavourite,
          isTrashed: b.isTrashed,
          folderId: b.folderId,
          updatedAt: b.updatedAt.toISOString(),
          postCount: b._count.posts,
        }))}
        emptyText="No favourites yet. Tap the heart on a board to save it here."
      />
    </div>
  );
}
