"use client";

import { useMemo, useState } from "react";
import type { Template, TemplateCategory } from "@/lib/templates";
import { useSearch } from "./SearchContext";
import TemplatePreview from "./TemplatePreview";
import TemplateModal from "./TemplateModal";

const CATEGORIES: ("All" | TemplateCategory)[] = [
  "All",
  "Education",
  "Work",
  "Personal",
  "Creative",
];

export default function TemplatesGrid({ templates }: { templates: Template[] }) {
  const { query } = useSearch();
  const [category, setCategory] = useState<"All" | TemplateCategory>("All");
  const [selected, setSelected] = useState<Template | null>(null);

  const filtered = useMemo(() => {
    let list = templates;
    if (category !== "All") list = list.filter((t) => t.category === category);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return list;
  }, [templates, category, query]);

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-7">
        {CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition border ${
                active
                  ? "bg-slate-900 text-white border-transparent shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-7">
        {filtered.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t)}
            className="text-left group animate-pop-in"
          >
            <div className="aspect-[16/11] relative rounded-2xl overflow-hidden border border-black/5 shadow-sm group-hover:shadow-xl group-hover:-translate-y-0.5 transition">
              <TemplatePreview template={t} variant="thumb" />
            </div>
            <div className="mt-3 px-1">
              <div className="font-semibold text-slate-900 text-[15px] leading-snug line-clamp-1">
                {t.name}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 capitalize">
                {t.category} · {t.layout}
              </div>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-24 text-slate-400">
          {query
            ? `No templates match "${query}"`
            : `No templates in ${category} yet.`}
        </div>
      )}

      {selected && (
        <TemplateModal
          template={selected}
          onClose={() => setSelected(null)}
          onPick={(t) => setSelected(t)}
        />
      )}
    </>
  );
}
