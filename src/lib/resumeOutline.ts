export type OutlineItem = { id: string; title: string; line: number };

export function buildOutline(markdown: string): OutlineItem[] {
  const lines = markdown.split('\n');
  const out: OutlineItem[] = [];
  lines.forEach((line, idx) => {
    const m = line.match(/^##\s+(.+)\s*$/);
    if (m?.[1]) out.push({ id: `${idx}-${m[1]}`, title: m[1], line: idx + 1 });
  });
  return out;
}
