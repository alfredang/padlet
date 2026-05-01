type Accent = "violet" | "emerald" | "rose" | "amber";

const ACCENTS: Record<Accent, string> = {
  violet: "from-violet-500 via-fuchsia-500 to-pink-500",
  emerald: "from-emerald-500 via-teal-500 to-cyan-500",
  rose: "from-rose-500 via-pink-500 to-fuchsia-500",
  amber: "from-amber-500 via-orange-500 to-red-500",
};

export default function PageHeader({
  title,
  subtitle,
  accent = "violet",
  right,
}: {
  title: string;
  subtitle?: string;
  accent?: Accent;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-8 gap-4">
      <div>
        <div className={`inline-block w-10 h-1.5 rounded-full bg-gradient-to-r ${ACCENTS[accent]} mb-3`} />
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
