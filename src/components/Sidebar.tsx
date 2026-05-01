"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Search,
  Clock,
  PenTool,
  Trash2,
  FolderHeart,
  FolderDown,
  FolderPlus,
  Folder,
  Sparkles,
} from "lucide-react";
import { useSearch } from "./SearchContext";
import Greeting from "./Greeting";
import ThemeToggle from "./ThemeToggle";

type FolderItem = { id: string; name: string };

const NAV = [
  { href: "/", label: "Recents", icon: Clock },
  { href: "/made-by-me", label: "Made by me", icon: PenTool },
  { href: "/templates", label: "Templates", icon: Sparkles },
  { href: "/trashed", label: "Trashed", icon: Trash2 },
];

const BOOKMARKS = [
  { href: "/favourites", label: "Favourites", icon: FolderHeart },
  { href: "/imports", label: "Imports", icon: FolderDown },
];

export default function Sidebar({ folders }: { folders: FolderItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { query, setQuery } = useSearch();
  const [busy, setBusy] = useState(false);

  async function createFolder() {
    const name = window.prompt("Folder name?");
    if (!name?.trim()) return;
    setBusy(true);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      const folder = await res.json();
      router.push(`/folders/${folder.id}`);
      router.refresh();
    }
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="w-72 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen sticky top-0">
      <div className="px-5 pt-5 pb-3">
        <Link href="/" className="inline-flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 grid place-items-center text-white font-extrabold shadow-sm">
            P
          </div>
          <span className="font-extrabold tracking-tight text-slate-900 dark:text-slate-100 text-lg">padlet</span>
        </Link>
        <Greeting />
        <div className="relative mt-5">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search padlets"
            className="w-full pl-10 pr-3 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-700 placeholder:text-slate-500 dark:placeholder:text-slate-400"
          />
        </div>
      </div>

      <nav className="px-3 pb-3 flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-2">
          {NAV.map((item) => (
            <SidebarItem key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </div>

        <div className="mt-6 px-5 mb-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Bookmarks
        </div>
        <div className="px-2">
          {BOOKMARKS.map((item) => (
            <SidebarItem key={item.href} {...item} active={isActive(item.href)} />
          ))}
          {folders.map((f) => (
            <SidebarItem
              key={f.id}
              href={`/folders/${f.id}`}
              label={f.name}
              icon={Folder}
              active={isActive(`/folders/${f.id}`)}
            />
          ))}
          <button
            onClick={createFolder}
            disabled={busy}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50 border-t border-slate-100 dark:border-slate-800 mt-1"
          >
            <FolderPlus size={18} />
            <span className="font-medium">New folder</span>
          </button>
        </div>
      </nav>

      <div className="border-t border-slate-100 dark:border-slate-800 p-3">
        <ThemeToggle />
      </div>
    </aside>
  );
}

function SidebarItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: any;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition border-t border-slate-100 dark:border-slate-800 first:border-t-0 ${
        active
          ? "text-violet-600 dark:text-violet-400 font-semibold"
          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
      }`}
    >
      <Icon
        size={18}
        className={active ? "text-violet-600 dark:text-violet-400" : "text-slate-500 dark:text-slate-400"}
        strokeWidth={active ? 2.4 : 2}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
