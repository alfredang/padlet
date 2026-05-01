import PageHeader from "@/components/PageHeader";
import { FolderDown } from "lucide-react";

export default function ImportsPage() {
  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <PageHeader title="Imports" subtitle="Boards shared with you or imported from files" accent="amber" />
      <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-12 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 grid place-items-center text-amber-600 dark:text-amber-400 mb-3">
          <FolderDown size={26} />
        </div>
        <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">No imports yet</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Imported boards will show up here once import is enabled.</p>
      </div>
    </div>
  );
}
