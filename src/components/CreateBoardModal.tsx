"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, LayoutGrid, Layers, AlignJustify, Columns3, Plus, Trash2 } from "lucide-react";
import { SOLIDS, GRADIENTS } from "@/lib/backgrounds";

const LAYOUTS = [
  { id: "grid", label: "Grid", desc: "Clean rows", icon: LayoutGrid },
  { id: "wall", label: "Wall", desc: "Free masonry", icon: Layers },
  { id: "stream", label: "Stream", desc: "Single column", icon: AlignJustify },
  { id: "shelf", label: "Shelf", desc: "Named columns", icon: Columns3 },
];

export default function CreateBoardModal({
  folderId,
  onClose,
}: {
  folderId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [background, setBackground] = useState(GRADIENTS[0].value);
  const [layout, setLayout] = useState("grid");
  const [sections, setSections] = useState<string[]>(["To do", "Doing", "Done"]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        background,
        layout,
        sections: layout === "shelf" ? sections.filter((s) => s.trim()) : null,
        folderId: folderId ?? null,
      }),
    });
    if (res.ok) {
      const board = await res.json();
      router.push(`/boards/${board.id}`);
    } else {
      alert("Failed to create board");
      setSubmitting(false);
    }
  }

  function updateSection(i: number, val: string) {
    setSections((prev) => prev.map((s, idx) => (idx === i ? val : s)));
  }
  function addSection() {
    setSections((prev) => [...prev, "New column"]);
  }
  function removeSection(i: number) {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg animate-pop-in overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 py-7 relative shrink-0"
          style={{ background }}
        >
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create a new board</h2>
          <p className="text-sm text-slate-700/80 mt-1">Pick a vibe and start posting.</p>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/80 hover:bg-white grid place-items-center text-slate-700 shadow-sm"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto scrollbar-thin">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My awesome board"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-700 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What's this board about?"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-700 resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Layout</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LAYOUTS.map((l) => {
                const Icon = l.icon;
                const active = layout === l.id;
                return (
                  <button
                    type="button"
                    key={l.id}
                    onClick={() => setLayout(l.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30 ring-2 ring-violet-200 dark:ring-violet-700"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <Icon size={18} className={active ? "text-violet-600 dark:text-violet-400" : "text-slate-500 dark:text-slate-400"} />
                    <div className="font-semibold text-sm mt-1.5 text-slate-900 dark:text-slate-100">{l.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{l.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {layout === "shelf" && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Columns</label>
              <div className="space-y-2">
                {sections.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={s}
                      onChange={(e) => updateSection(i, e.target.value)}
                      placeholder={`Column ${i + 1}`}
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-700"
                    />
                    {sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSection(i)}
                        className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 grid place-items-center text-slate-500 dark:text-slate-400"
                        aria-label="Remove column"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSection}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 text-sm font-medium text-slate-500 dark:text-slate-400"
                >
                  <Plus size={14} /> Add column
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Background</label>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Solid colors</div>
            <div className="flex gap-2 flex-wrap mb-3">
              {SOLIDS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setBackground(bg.value)}
                  title={bg.name}
                  className={`w-9 h-9 rounded-full border-2 transition shadow-sm ${
                    background === bg.value ? "border-violet-600 scale-110" : "border-white dark:border-slate-700"
                  }`}
                  style={{ background: bg.preview }}
                  aria-label={bg.name}
                />
              ))}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Gradients</div>
            <div className="flex gap-2 flex-wrap">
              {GRADIENTS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setBackground(bg.value)}
                  title={bg.name}
                  className={`w-9 h-9 rounded-full border-2 transition shadow-sm ${
                    background === bg.value ? "border-violet-600 scale-110" : "border-white dark:border-slate-700"
                  }`}
                  style={{ background: bg.preview }}
                  aria-label={bg.name}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold disabled:opacity-50 hover:from-violet-700 hover:to-fuchsia-700 shadow-sm"
            >
              {submitting ? "Creating…" : "Create board"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
