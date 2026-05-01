"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Upload,
  Camera,
  Sparkles,
  HardDrive,
  Loader2,
} from "lucide-react";
import type { Post } from "./PostCard";
import { detectEmbed } from "@/lib/embed";
import CameraCapture from "./CameraCapture";
import UrlImageDialog from "./UrlImageDialog";

const COLORS = [
  "#fffbeb", "#fce7f3", "#dbeafe", "#dcfce7",
  "#ede9fe", "#fed7aa", "#cffafe", "#fee2e2", "#ffffff",
];

type Draft = Omit<Post, "id" | "createdAt">;

export default function PostComposer({
  initial,
  sections,
  defaultSection,
  onClose,
  onSubmit,
}: {
  initial?: Post;
  sections?: string[];
  defaultSection?: string;
  onClose: () => void;
  onSubmit: (data: Draft) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [linkUrl, setLinkUrl] = useState(initial?.linkUrl ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [section, setSection] = useState<string | null>(
    initial?.section ?? defaultSection ?? sections?.[0] ?? null
  );
  const [linkPreview, setLinkPreview] = useState<{
    title: string | null;
    description: string | null;
    image: string | null;
  } | null>(
    initial && (initial.linkTitle || initial.linkImage)
      ? {
          title: initial.linkTitle,
          description: initial.linkDescription,
          image: initial.linkImage,
        }
      : null
  );

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [openCamera, setOpenCamera] = useState(false);
  const [openUrlDialog, setOpenUrlDialog] = useState<"ai" | "url" | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastPreviewedRef = useRef<string | null>(initial?.linkUrl ?? null);

  useEffect(() => {
    if (initial) return;
    const saved = typeof window !== "undefined" ? localStorage.getItem("padlet:name") : null;
    if (saved && !author) setAuthor(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!linkUrl) {
      setLinkPreview(null);
      lastPreviewedRef.current = null;
      return;
    }
    const e = detectEmbed(linkUrl);
    if (!e || e.type !== "link") {
      setLinkPreview(null);
      lastPreviewedRef.current = linkUrl;
      return;
    }
    if (lastPreviewedRef.current === linkUrl) return;

    const t = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(linkUrl)}`);
        if (res.ok) {
          const data = await res.json();
          setLinkPreview({
            title: data.title ?? null,
            description: data.description ?? null,
            image: data.image ?? null,
          });
          lastPreviewedRef.current = linkUrl;
        }
      } finally {
        setPreviewLoading(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [linkUrl]);

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Only image files are supported.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Upload failed: ${err?.error ?? res.statusText}`);
        return;
      }
      const { url } = await res.json();
      setImageUrl(url);
    } finally {
      setUploading(false);
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          uploadFile(file);
          e.preventDefault();
          return;
        }
      }
    }
    const text = e.clipboardData.getData("text/plain");
    if (text && /^https?:\/\/\S+$/i.test(text.trim()) && !linkUrl) {
      const target = e.target as HTMLElement;
      if (target.tagName !== "INPUT" || (target as HTMLInputElement).type !== "url") {
        if ((target.getAttribute("placeholder") || "").toLowerCase().includes("link")) return;
        setLinkUrl(text.trim());
      }
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !imageUrl && !linkUrl) return;
    setSubmitting(true);
    await onSubmit({
      title: title.trim() || null,
      body: body.trim(),
      color,
      imageUrl: imageUrl.trim() || null,
      linkUrl: linkUrl.trim() || null,
      linkTitle: linkPreview?.title ?? null,
      linkDescription: linkPreview?.description ?? null,
      linkImage: linkPreview?.image ?? null,
      author: author.trim() || null,
      section: section ?? null,
    });
    setSubmitting(false);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
        onClick={onClose}
      >
        <div
          className="rounded-2xl shadow-2xl w-full max-w-lg animate-pop-in overflow-hidden relative max-h-[92vh] flex flex-col"
          style={{ background: color }}
          onClick={(e) => e.stopPropagation()}
          onPaste={onPaste}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="flex items-center justify-between p-4 border-b border-black/5 shrink-0">
            <h2 className="font-bold">{initial ? "Edit post" : "New post"}</h2>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto scrollbar-thin">
            {dragOver && (
              <div className="absolute inset-4 rounded-xl border-2 border-dashed border-violet-500 bg-violet-50/85 grid place-items-center text-violet-700 font-semibold pointer-events-none z-20">
                Drop image to upload
              </div>
            )}

            {sections && sections.length > 0 && (
              <div>
                <div className="text-xs text-slate-700/80 mb-1.5 font-medium">Section</div>
                <div className="flex flex-wrap gap-1.5">
                  {sections.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSection(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
                        section === s
                          ? "bg-slate-900 text-white border-transparent"
                          : "bg-white/70 text-slate-700 border-transparent hover:bg-white"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!imageUrl && (
              <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-white/80 p-1.5 border border-black/5 shadow-sm">
                <MediaButton
                  icon={uploading ? Loader2 : Upload}
                  label="Upload"
                  spin={uploading}
                  onClick={() => fileInputRef.current?.click()}
                />
                <MediaButton
                  icon={Camera}
                  label="Camera"
                  onClick={() => setOpenCamera(true)}
                />
                <MediaButton
                  icon={Sparkles}
                  label="AI"
                  highlight
                  onClick={() => setOpenUrlDialog("ai")}
                />
                <MediaButton
                  icon={HardDrive}
                  label="From URL"
                  onClick={() => setOpenUrlDialog("url")}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full bg-transparent text-lg font-bold focus:outline-none placeholder:text-slate-500/60"
            />

            <textarea
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write something… (paste images, drop a file, or paste a link)"
              rows={4}
              className="w-full bg-transparent text-sm focus:outline-none resize-none placeholder:text-slate-500/60"
            />

            {imageUrl && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="w-full max-h-56 object-cover rounded-xl border border-black/10"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
                  aria-label="Remove image"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {linkPreview && (linkPreview.title || linkPreview.image) && (
              <div className="relative rounded-xl border border-black/10 bg-white/80 overflow-hidden">
                {linkPreview.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={linkPreview.image} alt="" className="w-full h-32 object-cover" />
                )}
                <div className="p-3 pr-9">
                  {linkPreview.title && (
                    <div className="font-semibold text-sm line-clamp-1">{linkPreview.title}</div>
                  )}
                  {linkPreview.description && (
                    <div className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                      {linkPreview.description}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLinkUrl("");
                    setLinkPreview(null);
                    lastPreviewedRef.current = null;
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
                  aria-label="Remove link"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {previewLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Loader2 size={14} className="animate-spin" /> Fetching link preview…
              </div>
            )}

            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Paste a link to embed (YouTube, article, …)"
              className="w-full rounded-lg bg-white/80 border border-black/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />

            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full rounded-lg bg-white/80 border border-black/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />

            <div>
              <div className="text-xs text-slate-700/80 mb-1.5 font-medium">Color</div>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition shadow-sm ${
                      color === c ? "border-violet-600 scale-110" : "border-white"
                    }`}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg bg-white/80 hover:bg-white text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || (!body.trim() && !imageUrl && !linkUrl)}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold disabled:opacity-50 hover:from-violet-700 hover:to-fuchsia-700 shadow-sm"
              >
                {submitting ? "Saving…" : initial ? "Save changes" : "Post"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {openCamera && (
        <CameraCapture
          onClose={() => setOpenCamera(false)}
          onUploaded={(url) => setImageUrl(url)}
        />
      )}
      {openUrlDialog && (
        <UrlImageDialog
          mode={openUrlDialog}
          onClose={() => setOpenUrlDialog(null)}
          onPick={(url) => setImageUrl(url)}
        />
      )}
    </>
  );
}

function MediaButton({
  icon: Icon,
  label,
  highlight,
  spin,
  onClick,
}: {
  icon: any;
  label: string;
  highlight?: boolean;
  spin?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-3 transition ${
        highlight
          ? "bg-gradient-to-br from-violet-100 to-fuchsia-100 hover:from-violet-200 hover:to-fuchsia-200 text-violet-700"
          : "bg-slate-50 hover:bg-slate-100 text-slate-700"
      }`}
    >
      <Icon size={20} className={spin ? "animate-spin" : ""} />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
