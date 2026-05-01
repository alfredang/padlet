"use client";

import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

export default function FolderActions({ folderId, folderName }: { folderId: string; folderName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function rename() {
    const name = prompt("Rename folder", folderName);
    if (!name?.trim() || name.trim() === folderName) return;
    setBusy(true);
    const res = await fetch(`/api/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete folder "${folderName}"? Boards inside will move to "Made by me".`)) return;
    setBusy(true);
    const res = await fetch(`/api/folders/${folderId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={rename}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium disabled:opacity-50"
      >
        <Pencil size={14} /> Rename
      </button>
      <button
        onClick={remove}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-sm font-medium disabled:opacity-50"
      >
        <Trash2 size={14} /> Delete folder
      </button>
    </div>
  );
}
