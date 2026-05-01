import PageHeader from "@/components/PageHeader";
import TemplatesGrid from "@/components/TemplatesGrid";
import { TEMPLATES } from "@/lib/templates";

export default function TemplatesPage() {
  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Templates"
        subtitle={`${TEMPLATES.length} beautiful boards, ready to use`}
        accent="violet"
      />
      <TemplatesGrid templates={TEMPLATES} />
    </div>
  );
}
