"use client";

import type { Template } from "@/lib/templates";

export default function TemplatePreview({
  template,
  variant = "thumb",
}: {
  template: Template;
  variant?: "thumb" | "full";
}) {
  const scale = variant === "thumb" ? 0.34 : 0.62;
  const inverse = `${100 / scale}%`;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: template.background }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: inverse,
          height: inverse,
        }}
      >
        <div className="px-7 pt-6 pb-4 flex items-start gap-3">
          <div className="shrink-0 w-12 h-12 rounded-full bg-white/80 grid place-items-center text-2xl shadow-sm">
            {template.emoji}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-700/70 font-medium">
              {template.sampleAuthor ?? "padlet user"} · 1m
            </div>
            <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-900">
              {template.name}
            </h2>
            {template.description && (
              <p className="text-sm text-slate-700/80 mt-1 line-clamp-2 max-w-2xl">
                {template.description}
              </p>
            )}
          </div>
        </div>

        {template.layout === "shelf" && template.sections ? (
          <ShelfPreview template={template} />
        ) : (
          <FlowPreview template={template} />
        )}
      </div>
    </div>
  );
}

function FlowPreview({ template }: { template: Template }) {
  const layoutClass =
    template.layout === "wall"
      ? "columns-3 gap-3 [&>*]:mb-3 [&>*]:break-inside-avoid"
      : template.layout === "stream"
      ? "flex flex-col gap-3 max-w-3xl mx-auto"
      : "grid grid-cols-3 gap-3";

  return (
    <div className="px-7 pb-7">
      <div className={layoutClass}>
        {template.posts.map((p, i) => (
          <PostBubble key={i} post={p} />
        ))}
      </div>
    </div>
  );
}

function ShelfPreview({ template }: { template: Template }) {
  return (
    <div className="px-7 pb-7 flex gap-3 items-start overflow-x-hidden">
      {template.sections!.map((section) => {
        const sectionPosts = template.posts.filter((p) => p.section === section);
        return (
          <div key={section} className="w-72 shrink-0 bg-black/5 rounded-xl p-3">
            <div className="flex items-center justify-between px-1 py-1 mb-2">
              <div className="font-bold text-sm text-slate-900 truncate">{section}</div>
              <div className="text-[10px] font-semibold text-slate-600 bg-white/80 px-1.5 py-0.5 rounded-full">
                {sectionPosts.length}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {sectionPosts.slice(0, 5).map((p, i) => (
                <PostBubble key={i} post={p} />
              ))}
              {sectionPosts.length > 5 && (
                <div className="text-[10px] text-center text-slate-500 font-medium pt-1">
                  +{sectionPosts.length - 5} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PostBubble({ post }: { post: any }) {
  return (
    <div
      className="rounded-xl shadow-sm border border-black/5 p-3 overflow-hidden"
      style={{ background: post.color ?? "#fffbeb" }}
    >
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imageUrl}
          alt=""
          className="w-full h-24 object-cover rounded mb-2"
        />
      )}
      {post.title && (
        <div className="font-bold text-[13px] text-slate-900 leading-snug mb-1 line-clamp-2">
          {post.title}
        </div>
      )}
      {post.body && (
        <div className="text-[11px] text-slate-700 leading-snug whitespace-pre-wrap line-clamp-5">
          {post.body}
        </div>
      )}
      {post.author && (
        <div className="text-[10px] text-slate-600/80 mt-2 pt-1.5 border-t border-black/5 font-medium">
          {post.author}
        </div>
      )}
    </div>
  );
}
