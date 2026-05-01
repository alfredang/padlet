"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Loader2,
  MessageCircle,
  MessageSquare,
  ListChecks,
  GraduationCap,
  Lightbulb,
  Star,
  BookOpen,
  CheckCircle2,
  Calendar,
  Users,
  Heart,
  Palette,
  Tag as TagIcon,
} from "lucide-react";
import type { Template } from "@/lib/templates";
import { getRelatedTemplates } from "@/lib/templates";
import TemplatePreview from "./TemplatePreview";

const TAG_ICONS: Record<string, any> = {
  Communication: MessageCircle,
  Discussion: MessageSquare,
  "Task management": ListChecks,
  Lessons: GraduationCap,
  Brainstorming: Lightbulb,
  Showcase: Star,
  Reflection: BookOpen,
  Assessment: CheckCircle2,
  Planning: Calendar,
  Team: Users,
  Personal: Heart,
  Creative: Palette,
  "Grades K-12": GraduationCap,
  "Grades 3-12": GraduationCap,
  "Higher ed": GraduationCap,
};

export default function TemplateModal({
  template,
  onClose,
  onPick,
}: {
  template: Template;
  onClose: () => void;
  onPick: (t: Template) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const related = getRelatedTemplates(template.id, 4);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function create() {
    setBusy(true);
    const res = await fetch("/api/boards/from-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: template.id }),
    });
    setBusy(false);
    if (!res.ok) {
      alert("Failed to create board");
      return;
    }
    const board = await res.json();
    router.push(`/boards/${board.id}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 sm:p-6 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl animate-pop-in overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/95 hover:bg-white shadow-md grid place-items-center text-slate-700"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <button
              onClick={create}
              disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold shadow-lg disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : null}
              {busy ? "Creating…" : "Create"}
            </button>
          </div>

          <div className="relative aspect-[16/10] border-b border-slate-100 bg-slate-50">
            <TemplatePreview template={template} variant="full" />
          </div>
        </div>

        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {template.name}
            </h2>
            <button
              onClick={create}
              disabled={busy}
              className="text-sm font-bold text-slate-700 hover:underline shrink-0"
            >
              See example
            </button>
          </div>

          <p className="text-slate-600 mt-2 leading-relaxed">{template.description}</p>

          <div className="flex flex-wrap gap-2 mt-5">
            {template.tags.map((t) => {
              const Icon = TAG_ICONS[t] ?? TagIcon;
              return (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold"
                >
                  <Icon size={13} className="text-slate-500" />
                  {t}
                </span>
              );
            })}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold">
              <Palette size={13} className="text-violet-500" />
              {template.category}
            </span>
          </div>

          {related.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Related</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {related.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onPick(r)}
                    className="text-left group"
                  >
                    <div className="aspect-[4/3] relative rounded-lg overflow-hidden border border-slate-200 group-hover:border-violet-300 group-hover:shadow-md transition">
                      <TemplatePreview template={r} variant="thumb" />
                    </div>
                    <div className="mt-1.5 text-xs font-semibold text-slate-700 line-clamp-1">
                      {r.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
