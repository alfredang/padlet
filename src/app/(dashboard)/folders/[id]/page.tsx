import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BoardGrid from "@/components/BoardGrid";
import PageHeader from "@/components/PageHeader";
import FolderActions from "@/components/FolderActions";

export const dynamic = "force-dynamic";

export default async function FolderPage({ params }: { params: { id: string } }) {
  const folder = await prisma.folder.findUnique({
    where: { id: params.id },
    include: {
      boards: {
        where: { isTrashed: false },
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { posts: true } } },
      },
    },
  });
  if (!folder) notFound();

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={folder.name}
        subtitle={`${folder.boards.length} board${folder.boards.length === 1 ? "" : "s"} in this folder`}
        accent="violet"
        right={<FolderActions folderId={folder.id} folderName={folder.name} />}
      />
      <BoardGrid
        variant="folder"
        folderId={folder.id}
        boards={folder.boards.map((b) => ({
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
        emptyText="This folder is empty. Create a board to get started."
      />
    </div>
  );
}
