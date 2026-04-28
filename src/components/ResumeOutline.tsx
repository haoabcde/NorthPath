'use client';

import { buildOutline } from '../lib/resumeOutline';

export default function ResumeOutline({
  markdown,
  onJumpToLine,
  collapsedLines = [],
  onToggleLine,
}: {
  markdown: string;
  onJumpToLine: (line: number) => void;
  collapsedLines?: number[];
  onToggleLine?: (line: number) => void;
}) {
  const items = buildOutline(markdown);
  if (items.length === 0) return null;
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
      <div className="text-[13px] font-semibold text-[#1F2933] mb-2">简历导航</div>
      <div className="space-y-2">
        {items.map((item) => {
          const isCollapsed = collapsedLines.includes(item.line);
          return (
            <div key={item.id} className="flex items-center justify-between gap-2">
              <button onClick={() => onJumpToLine(item.line)} className="flex-1 text-left text-[13px] text-[#235C4E] hover:underline">
                {item.title}
              </button>
              {onToggleLine && (
                <button
                  onClick={() => onToggleLine(item.line)}
                  className="shrink-0 px-2 py-1 text-[11px] border border-[#E5E7EB] rounded text-[#6B7280] hover:bg-[#F7F8F6] transition-colors"
                >
                  {isCollapsed ? '展开' : '折叠'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
