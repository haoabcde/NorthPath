import { parseMarkdownBlocks } from './markdownParse';

export async function exportDocx(markdown: string, fileName: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');

  const blocks = parseMarkdownBlocks(markdown);
  const children = blocks.map((block) => {
    if (block.type === 'heading') {
      const heading =
        block.level === 1 ? HeadingLevel.HEADING_1 : block.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      return new Paragraph({ text: block.text, heading });
    }
    if (block.type === 'bullet') {
      return new Paragraph({
        children: [new TextRun(block.text)],
        bullet: { level: 0 },
      });
    }
    return new Paragraph({ children: [new TextRun(block.text)] });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

