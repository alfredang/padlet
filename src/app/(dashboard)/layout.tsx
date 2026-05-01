import { prisma } from "@/lib/prisma";
import DashboardShell from "@/components/DashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const folders = await prisma.folder.findMany({ orderBy: { createdAt: "asc" } });
  return <DashboardShell folders={folders.map((f) => ({ id: f.id, name: f.name }))}>{children}</DashboardShell>;
}
