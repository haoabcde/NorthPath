'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, Compass, Home, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { useResumeStore } from '../store/useResumeStore';
import { buildCalibrationReport } from '../lib/report';
import { runCalibrationPipeline, type CalibrationProgress as PipelineProgress } from '../lib/calibrationPipeline';
import { clearCalibrationJob, readCalibrationJob, updateCalibrationJobStatus, type CalibrationJobState } from '../lib/calibrationJob';

const STEPS = ['岗位坐标解析', '简历航向判断', '内容模块体检', '关键段落修正', '优化轨迹回放'];

export default function CalibrationProgress() {
  const router = useRouter();
  const { createResume, setReport } = useResumeStore();
  const startedRef = useRef(false);
  const [job, setJob] = useState<CalibrationJobState | null>(null);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const pending = readCalibrationJob();
    setJob(pending);
    if (!pending || startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      setError('');
      updateCalibrationJobStatus('running');
      try {
        const aiReport = await runCalibrationPipeline(pending.input, setProgress);
        const resumeId = await createResume(`校准版本: ${pending.input.jobTitle}`, pending.input.jobTitle, pending.input.resumeText, {
          targetStage: pending.input.jobStage,
          targetDirection: pending.input.jobDirection,
          source: 'imported',
        });
        const report = buildCalibrationReport(aiReport, resumeId);
        await setReport(report);
        updateCalibrationJobStatus('done');
        clearCalibrationJob();
        router.replace(`/calibration/report/${resumeId}`);
      } catch (err) {
        updateCalibrationJobStatus('failed');
        setError(err instanceof Error ? err.message : '校准过程中发生错误');
      }
    };

    void run();
  }, [createResume, router, setReport]);

  const currentStep = progress?.step ?? 1;

  if (!job) {
    return (
      <div className="aurora-workspace min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-xl bg-white border border-[#E5E7EB] rounded-lg p-10 text-center shadow-sm">
          <Compass className="w-12 h-12 mx-auto text-[#235C4E] mb-5" />
          <h1 className="text-[26px] font-bold text-[#1F2933] mb-3">没有待校准任务</h1>
          <p className="text-[15px] text-[#6B7280] mb-8">请先填写目标岗位和简历内容，再进入校准流程。</p>
          <button
            onClick={() => router.replace('/calibration')}
            className="px-5 py-3 bg-[#235C4E] text-white rounded-lg font-semibold"
          >
            返回校准输入页
          </button>
          <button
            onClick={() => router.push('/')}
            className="ml-3 px-5 py-3 bg-white border border-[#E5E7EB] text-[#1F2933] rounded-lg font-semibold"
          >
            回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="aurora-workspace min-h-screen flex flex-col text-[#1F2933]">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-6">
        <button
          onClick={() => router.replace('/calibration')}
          className="flex items-center text-[#6B7280] hover:text-[#1F2933] transition-colors text-[14px] font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回输入页
        </button>
        <div className="flex items-center gap-2 font-semibold">
          <Compass className="w-4 h-4 text-[#235C4E]" />
          北极星校准中
        </div>
        <button
          onClick={() => router.push('/')}
          className="flex items-center text-[#6B7280] hover:text-[#1F2933] transition-colors text-[14px] font-medium"
        >
          <Home className="w-4 h-4 mr-2" />
          回首页
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-8 py-10">
        <div className="w-full max-w-6xl grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-center">
          <section>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#235C4E]/8 text-[#235C4E] text-[13px] font-semibold mb-5">
              <Sparkles className="w-4 h-4" />
              {job.input.jobStage} · {job.input.jobDirection || '通用'}
            </div>
            <h1 className="text-[42px] font-bold tracking-tight text-[#1F2933] leading-tight">
              正在校准「{job.input.jobTitle}」
            </h1>
            <p className="text-[17px] text-[#6B7280] mt-5 max-w-2xl leading-relaxed">
              系统正在拆解岗位坐标、检查证据链、扫描空泛表达，并生成可定位到编辑器的修正路线。
            </p>

            {error ? (
              <div className="mt-8 bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-semibold text-[#991B1B] mb-1">校准失败</h2>
                    <p className="text-[14px] text-[#B91C1C] leading-relaxed">{error}</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-[#235C4E] text-white rounded-lg text-[14px] font-semibold flex items-center"
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" />
                    重试
                  </button>
                  <button
                    onClick={() => router.replace('/calibration')}
                    className="px-4 py-2 bg-white border border-[#E5E7EB] text-[#1F2933] rounded-lg text-[14px] font-semibold"
                  >
                    返回修改输入
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex items-center gap-3 text-[#235C4E]">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-semibold">{progress?.title ?? '准备校准任务'}...</span>
              </div>
            )}
          </section>

          <section className="bg-white border border-[#E5E7EB] rounded-lg p-8 shadow-sm">
            <div className="space-y-6">
              {STEPS.map((step, index) => {
                const stepNumber = index + 1;
                const isDone = currentStep > stepNumber && !error;
                const isActive = currentStep === stepNumber && !error;
                return (
                  <div key={step} className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                        isDone
                          ? 'bg-[#235C4E] border-[#235C4E] text-white'
                          : isActive
                            ? 'bg-[#235C4E]/10 border-[#235C4E] text-[#235C4E] ring-4 ring-[#235C4E]/8'
                            : 'bg-[#F7F8F6] border-[#E5E7EB] text-[#9CA3AF]'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-5 h-5" /> : stepNumber}
                    </div>
                    <div className="flex-1">
                      <div className={`text-[17px] font-semibold ${isActive || isDone ? 'text-[#1F2933]' : 'text-[#9CA3AF]'}`}>
                        {step}
                      </div>
                      {isActive && progress?.stats && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Object.entries(progress.stats).map(([key, value]) => (
                            <span key={key} className="px-2 py-1 bg-[#F7F8F6] border border-[#E5E7EB] rounded text-[12px] text-[#6B7280]">
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isActive && <span className="text-[13px] font-semibold text-[#235C4E]">处理中</span>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
