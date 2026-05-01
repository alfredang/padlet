"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Trash2, Heart, Undo2, FileText } from "lucide-react";
import CreateBoardModal from "./CreateBoardModal";
import { useSearch } from "./SearchContext";

export type BoardSummary = {
  id: string;
  title: string;
  description: string | null;
  background: string;
  layout: string;
  isFavourite: boolean;
  isTrashed: boolean;
  folderId: string | null;
  updatedAt: string;
  postCount: number;
};

type Variant = "default" | "trashed" | "favourites" | "folder";

export default function BoardGrid({
  boards,
  variant = "default",
  folderId,
  emptyText,
}: {
  boards: BoardSummary[];
  variant?: Variant;
  folderId?: string;
  emptyText?: string;
}) {
  const router = useRouter();
  const { query } = useSearch();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!query) return boards;
    const q = query.toLowerCase();
    return boards.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.description ?? "").toLowerCase().includes(q)
    );
  }, [boards, query]);

  async function patch(id: string, body: any) {
    setBusyId(id);
    const res = await fetch(`/api/boards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (res.ok) router.refresh();
  }

  async function softDelete(id: string) {
    if (!confirm("Move this board to Trashed?")) return;
    setBusyId(id);
    const res = await fetch(`/api/boards/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) router.refresh();
  }

  async function hardDelete(id: string) {
    if (!confirm("Delete forever? This cannot be undone.")) return;
    setBusyId(id);
    const res = await fetch(`/api/boards/${id}?hard=1`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) router.refresh();
  }

  const showCreate = variant === "default" || variant === "folder";

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {showCreate && (
          <button
            onClick={() => setOpen(true)}
            className="group rounded-2xl border-2 border-dashed border-slate-300 hover:border-violet-400 hover:bg-violet-50/40 p-6 min-h-[200px] flex flex-col items-center justify-center text-slate-500 hover:text-violet-700 transition animate-pop-in"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 via-fuchsia-100 to-pink-100 group-hover:scale-105 grid place-items-center mb-3 transition shadow-sm">
              <Plus size={26} className="text-violet-600" />
            </div>
            <span className="font-semibold">Create new board</span>
            <span className="text-xs text-slate-400 mt-1">Blank canvas to start collecting</span>
          </button>
        )}

        {filtered.map((board) => (
          <div key={board.id} className="relative group animate-pop-in">
            <Link
              href={`/boards/${board.id}`}
              className="block rounded-2xl p-5 min-h-[200px] shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition border border-black/5 overflow-hidden relative"
              style={{ background: board.background }}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-semibold text-slate-700/80 capitalize bg-white/70 px-2 py-0.5 rounded-full tracking-wider uppercase">
                  {board.layout}
                </span>
                {board.isFavourite && (
                  <Heart size={16} className="text-rose-500 fill-rose-500" />
                )}
              </div>
              <h3 className="font-bold text-lg leading-snug line-clamp-2 text-slate-900 mb-1">
                {board.title}
              </h3>
              {board.description && (
                <p className="text-sm text-slate-700/80 line-clamp-2">{board.description}</p>
              )}
              <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-xs text-slate-700/70">
                <span className="inline-flex items-center gap-1.5">
                  <FileText size={13} /> {board.postCount} {board.postCount === 1 ? "post" : "posts"}
                </span>
                <span>{relTime(board.updatedAt)}</span>
              </div>
            </Link>

            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
              {variant !== "trashed" && (
                <button
                  disabled={busyId === board.id}
                  onClick={(e) => {
                    e.preventDefault();
                    patch(board.id, { isFavourite: !board.isFavourite });
                  }}
                  className="w-8 h-8 rounded-full bg-white/95 grid place-items-center text-slate-600 hover:text-rose-500 shadow-sm"
                  aria-label="Favourite"
                >
                  <Heart size={15} className={board.isFavourite ? "text-rose-500 fill-rose-500" : ""} />
                </button>
              )}
              {variant === "trashed" ? (
                <>
                  <button
                    disabled={busyId === board.id}
                    onClick={() => patch(board.id, { isTrashed: false })}
                    className="w-8 h-8 rounded-full bg-white/95 grid place-items-center text-slate-600 hover:text-violet-600 shadow-sm"
                    aria-label="Restore"
                    title="Restore"
                  >
                    <Undo2 size={15} />
                  </button>
                  <button
                    disabled={busyId === board.id}
                    onClick={() => hardDelete(board.id)}
                    className="w-8 h-8 rounded-full bg-white/95 grid place-items-center text-slate-600 hover:text-red-600 shadow-sm"
                    aria-label="Delete forever"
                    title="Delete forever"
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              ) : (
                <button
                  disabled={busyId === board.id}
                  onClick={() => softDelete(board.id)}
                  className="w-8 h-8 rounded-full bg-white/95 grid place-items-center text-slate-600 hover:text-red-600 shadow-sm"
                  aria-label="Move to trash"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-24 text-slate-400">
          {query ? `No boards match "${query}"` : emptyText ?? "Nothing here yet."}
        </div>
      )}

      {open && <CreateBoardModal folderId={folderId} onClose={() => setOpen(false)} />}
    </>
  );
}

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
