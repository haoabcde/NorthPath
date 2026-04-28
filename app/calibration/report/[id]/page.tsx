import CalibrationReportPage from '@/views/CalibrationReportPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CalibrationReportPage resumeId={id} />;
}

