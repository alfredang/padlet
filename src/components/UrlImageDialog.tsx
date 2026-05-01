"use client";

import { useState } from "react";
import { X, Sparkles, Link as LinkIcon, Loader2 } from "lucide-react";

export default function UrlImageDialog({
  mode,
  onClose,
  onPick,
}: {
  mode: "ai" | "url";
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const isAi = mode === "ai";

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setGenerating(true);
    const seed = Math.floor(Math.random() * 1_000_000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt.trim()
    )}?width=1024&height=768&seed=${seed}&nologo=true`;
    setGeneratedUrl(url);
    setGenerating(false);
  }

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    onPick(prompt.trim());
    onClose();
  }

  function useGenerated() {
    if (!generatedUrl) return;
    onPick(generatedUrl);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-pop-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="font-bold flex items-center gap-2">
            {isAi ? <Sparkles size={18} className="text-violet-600" /> : <LinkIcon size={18} className="text-violet-600" />}
            {isAi ? "Generate with AI" : "Add image from a link"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={isAi ? handleGenerate : handleUrlSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              {isAi ? "Describe the image" : "Image URL or sharing link"}
            </label>
            {isAi ? (
              <textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A watercolor painting of a coastal Italian village at golden hour, soft cypress trees in the distance"
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300 placeholder:text-slate-400 resize-none"
                required
              />
            ) : (
              <input
                autoFocus
                type="url"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="https://… (paste any image URL or Google Drive shareable link)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300 placeholder:text-slate-400"
                required
              />
            )}
            {isAi && (
              <p className="text-xs text-slate-500 mt-1.5">
                Powered by <span className="font-semibold">image.pollinations.ai</span> — free, no signup. First load takes ~10s.
              </p>
            )}
            {!isAi && (
              <p className="text-xs text-slate-500 mt-1.5">
                For Google Drive: open the file → Share → "Anyone with the link" → copy link.
              </p>
            )}
          </div>

          {generatedUrl && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedUrl}
                alt="Generated"
                className="w-full max-h-64 object-cover"
                onLoad={() => setGenerating(false)}
                onError={() => setGenerating(false)}
              />
              {generating && (
                <div className="absolute inset-0 grid place-items-center bg-slate-50/80">
                  <Loader2 size={28} className="animate-spin text-violet-600" />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-medium text-sm"
            >
              Cancel
            </button>
            {isAi && generatedUrl ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedUrl(null);
                    handleGenerate({ preventDefault: () => {} } as any);
                  }}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-medium text-sm"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={useGenerated}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-sm hover:from-violet-700 hover:to-fuchsia-700 shadow-sm"
                >
                  Use this image
                </button>
              </>
            ) : (
              <button
                type="submit"
                disabled={generating || !prompt.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-sm disabled:opacity-50 hover:from-violet-700 hover:to-fuchsia-700 shadow-sm inline-flex items-center justify-center gap-2"
              >
                {generating && <Loader2 size={15} className="animate-spin" />}
                {isAi ? (generating ? "Generating…" : "Generate") : "Add image"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
