import mammoth from 'mammoth/mammoth.browser.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface PdfTextContentItem {
  str?: string;
}

export async function parseFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`文件大小不能超过 10MB。当前文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  }

  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'txt':
    case 'md':
      return await file.text();
    case 'pdf':
      return await parsePDF(file);
    case 'docx':
      return await parseDocx(file);
    default:
      throw new Error(`不支持的文件格式: .${extension}，请上传 PDF、DOCX、TXT 或 MD 文件。`);
  }
}

async function parsePDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as PdfTextContentItem[])
      .map((item) => item.str ?? '')
      .join(' ');
    fullText += pageText + '\n\n';
  }

  return fullText.trim();
}

async function parseDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}
