export function estimatePdfPages({
  canvasWidth,
  canvasHeight,
  pdfWidth,
  pageHeight,
}: {
  canvasWidth: number;
  canvasHeight: number;
  pdfWidth: number;
  pageHeight: number;
}) {
  const safeWidth = canvasWidth > 0 ? canvasWidth : 1;
  const imgHeight = (canvasHeight * pdfWidth) / safeWidth;
  return Math.max(1, Math.ceil(imgHeight / pageHeight));
}

