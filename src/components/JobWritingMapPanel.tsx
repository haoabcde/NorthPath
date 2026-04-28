import type { JobWritingMap } from '../lib/jobWritingMap';

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="font-semibold text-[#1F2933] mb-1">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={`${title}-${item}`}
            className="px-2 py-1 bg-white/70 border border-[#235C4E]/10 rounded text-[12px] text-[#6B7280]"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function JobWritingMapPanel({
  map,
  isLoading,
  error,
}: {
  map: JobWritingMap | null;
  isLoading?: boolean;
  error?: string;
}) {
  if (isLoading) {
    return <div className="text-[13px] text-[#6B7280]">正在生成岗位写作地图...</div>;
  }

  if (error) {
    return <div className="text-[13px] text-red-600">{error}</div>;
  }

  if (!map) {
    return <div className="text-[13px] text-[#6B7280]">填写目标岗位信息后自动生成</div>;
  }

  return (
    <div className="space-y-4 text-[13px]">
      <Section title="🎯 岗位核心能力" items={map.coreAbilities} />
      <Section title="✅ 必须出现的内容" items={map.mustHave} />
      <Section title="⏬ 可以弱化的内容" items={map.canDeprioritize} />
      <Section title="🔄 大学生可替代证明" items={map.studentProofs} />
      <Section title="📑 推荐简历结构" items={map.recommendedStructure} />
    </div>
  );
}

