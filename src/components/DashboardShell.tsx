"use client";

import { SearchProvider } from "./SearchContext";
import Sidebar from "./Sidebar";

type FolderItem = { id: string; name: string };

export default function DashboardShell({
  folders,
  children,
}: {
  folders: FolderItem[];
  children: React.ReactNode;
}) {
  return (
    <SearchProvider>
      <div className="flex min-h-screen">
        <Sidebar folders={folders} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </SearchProvider>
  );
}
