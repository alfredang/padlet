"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import PostCard, { type Post } from "./PostCard";
import PostComposer from "./PostComposer";

export default function BoardClient({
  boardId,
  layout,
  sections,
  initialPosts,
}: {
  boardId: string;
  layout: string;
  sections: string[] | null;
  initialPosts: Post[];
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [composing, setComposing] = useState<{ section?: string } | null>(null);
  const [editing, setEditing] = useState<Post | null>(null);

  async function handleCreate(data: Omit<Post, "id" | "createdAt">) {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, boardId }),
    });
    if (!res.ok) {
      alert("Failed to create post");
      return;
    }
    const post: Post = await res.json();
    setPosts((prev) => [post, ...prev]);
    setComposing(null);
  }

  async function handleUpdate(id: string, data: Omit<Post, "id" | "createdAt">) {
    const res = await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      alert("Failed to update post");
      return;
    }
    const updated: Post = await res.json();
    setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this post?")) return;
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to delete post");
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  const isShelf = layout === "shelf" && sections && sections.length > 0;

  if (isShelf) {
    return (
      <>
        <div className="px-6 py-6 overflow-x-auto scrollbar-thin">
          <div className="flex gap-4 items-start min-w-max pb-2">
            {sections!.map((section) => {
              const sectionPosts = posts.filter((p) => p.section === section);
              return (
                <div
                  key={section}
                  className="w-80 shrink-0 bg-black/5 rounded-2xl p-3 flex flex-col"
                >
                  <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                    <h3 className="font-bold text-slate-900 truncate">{section}</h3>
                    <span className="text-xs text-slate-600 font-semibold bg-white/80 px-2 py-0.5 rounded-full shrink-0 ml-2">
                      {sectionPosts.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {sectionPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onEdit={setEditing}
                        onDelete={handleDelete}
                      />
                    ))}
                    <button
                      onClick={() => setComposing({ section })}
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-white/70 hover:bg-white text-sm font-semibold text-slate-700 transition border border-transparent hover:border-black/5"
                    >
                      <Plus size={14} /> Add post
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => setComposing({ section: sections![0] })}
          aria-label="Add post"
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 text-white shadow-xl hover:scale-105 active:scale-95 transition flex items-center justify-center z-30"
        >
          <Plus size={26} />
        </button>

        {composing && (
          <PostComposer
            sections={sections!}
            defaultSection={composing.section}
            onClose={() => setComposing(null)}
            onSubmit={handleCreate}
          />
        )}
        {editing && (
          <PostComposer
            initial={editing}
            sections={sections ?? undefined}
            onClose={() => setEditing(null)}
            onSubmit={(data) => handleUpdate(editing.id, data)}
          />
        )}
      </>
    );
  }

  const layoutClass =
    layout === "wall"
      ? "columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid"
      : layout === "stream"
      ? "max-w-2xl mx-auto flex flex-col gap-4"
      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";

  return (
    <>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {posts.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-3">📌</div>
            <div className="text-slate-700/80 mb-4 font-medium">This board is empty.</div>
            <button
              onClick={() => setComposing({})}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/90 hover:bg-white shadow-sm font-semibold"
            >
              <Plus size={18} /> Add first post
            </button>
          </div>
        ) : (
          <div className={layoutClass}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onEdit={setEditing} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setComposing({})}
        aria-label="Add post"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 text-white shadow-xl hover:scale-105 active:scale-95 transition flex items-center justify-center z-30"
      >
        <Plus size={26} />
      </button>

      {composing && (
        <PostComposer onClose={() => setComposing(null)} onSubmit={handleCreate} />
      )}
      {editing && (
        <PostComposer
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(data) => handleUpdate(editing.id, data)}
        />
      )}
    </>
  );
}
