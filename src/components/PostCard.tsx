"use client";

import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { detectEmbed, youtubeEmbedUrl, vimeoEmbedUrl } from "@/lib/embed";

export type Post = {
  id: string;
  title: string | null;
  body: string;
  color: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  linkImage: string | null;
  author: string | null;
  section: string | null;
  createdAt: string;
};

export default function PostCard({
  post,
  onEdit,
  onDelete,
}: {
  post: Post;
  onEdit: (p: Post) => void;
  onDelete: (id: string) => void;
}) {
  const embed = detectEmbed(post.linkUrl);

  return (
    <div
      className="group relative rounded-2xl shadow-sm hover:shadow-xl transition overflow-hidden border border-black/5 animate-pop-in"
      style={{ background: post.color }}
    >
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" className="w-full max-h-80 object-cover" />
      )}

      {embed?.type === "youtube" && (
        <div className="aspect-video bg-black">
          <iframe
            src={youtubeEmbedUrl(embed.videoId)}
            className="w-full h-full"
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {embed?.type === "vimeo" && (
        <div className="aspect-video bg-black">
          <iframe
            src={vimeoEmbedUrl(embed.videoId)}
            className="w-full h-full"
            title="Vimeo video"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {embed?.type === "image" && !post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={embed.url} alt="" className="w-full max-h-80 object-cover" />
      )}

      <div className="p-4">
        {post.title && (
          <h3 className="font-bold text-slate-900 mb-1.5 leading-snug">{post.title}</h3>
        )}
        {post.body && (
          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed break-words">
            {post.body}
          </p>
        )}

        {embed?.type === "link" && (post.linkTitle || post.linkImage) && (
          <a
            href={embed.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-xl border border-black/10 bg-white/70 hover:bg-white overflow-hidden transition"
          >
            {post.linkImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.linkImage} alt="" className="w-full h-32 object-cover" />
            )}
            <div className="p-3">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                {safeHostname(embed.url)}
              </div>
              {post.linkTitle && (
                <div className="font-semibold text-sm text-slate-900 line-clamp-2 mt-0.5">
                  {post.linkTitle}
                </div>
              )}
              {post.linkDescription && (
                <div className="text-xs text-slate-600 line-clamp-2 mt-1">
                  {post.linkDescription}
                </div>
              )}
            </div>
          </a>
        )}

        {embed?.type === "link" && !post.linkTitle && !post.linkImage && (
          <a
            href={embed.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-violet-700 hover:underline break-all"
          >
            <ExternalLink size={12} /> {embed.url}
          </a>
        )}

        {(embed?.type === "youtube" || embed?.type === "vimeo") && post.linkUrl && (
          <a
            href={post.linkUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 hover:underline"
          >
            <ExternalLink size={11} /> Open original
          </a>
        )}

        <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between text-xs text-slate-700/70">
          <span className="font-medium">{post.author || "Anonymous"}</span>
          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={() => onEdit(post)}
          aria-label="Edit post"
          className="w-8 h-8 rounded-full bg-white/95 grid place-items-center text-slate-600 hover:text-violet-600 shadow-sm"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onDelete(post.id)}
          aria-label="Delete post"
          className="w-8 h-8 rounded-full bg-white/95 grid place-items-center text-slate-600 hover:text-red-600 shadow-sm"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
