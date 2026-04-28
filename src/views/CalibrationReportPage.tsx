'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, CheckCircle2, Compass, Home } from 'lucide-react';
import { useResumeStore } from '../store/useResumeStore';
import { reportStatusClass } from '../lib/report';

type TabId = 'hits' | 'evidence' | 'modules' | 'vague' | 'tasks';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'hits', label: '岗位命中' },
  { id: 'evidence', label: '证据链' },
  { id: 'modules', label: '内容体检' },
  { id: 'vague', label: '空泛扫描' },
  { id: 'tasks', label: '修正路线' },
];

export default function CalibrationReportPage({ resumeId }: { resumeId: string }) {
  const router = useRouter();
  const { currentResume, report, loadResume, isLoading } = useResumeStore();
  const [activeTab, setActiveTab] = useState<TabId>('hits');
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setHasLoaded(false);
    void loadResume(resumeId).finally(() => {
      if (isMounted) setHasLoaded(true);
    });
    return () => {
      isMounted = false;
    };
  }, [loadResume, resumeId]);

  const risks = useMemo(() => {
    if (!report) return [];
    return [
      ...report.tasks.filter((task) => task.level === 'P0').slice(0, 2).map((task) => task.description),
      ...report.vagueExpressions.filter((item) => item.level === 'P0').slice(0, 1).map((item) => item.problem),
    ].slice(0, 3);
  }, [report]);

  const goEditor = (analysis?: string, target?: string) => {
    const query = analysis && target ? `?analysis=${analysis}&target=${target}` : '';
    router.push(`/editor/${resumeId}${query}`);
  };

  if (isLoading || !hasLoaded) {
    return (
      <div className="aurora-workspace min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#235C4E] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!currentResume) {
    return (
      <div className="aurora-workspace min-h-screen flex items-center justify-center p-8">
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-10 max-w-xl text-center shadow-sm">
          <Compass className="w-12 h-12 text-[#235C4E] mx-auto mb-5" />
          <h1 className="text-[26px] font-bold mb-3">未找到这份校准报告</h1>
          <p className="text-[#6B7280] mb-7">本地版本库中没有对应简历记录，请重新校准或从版本库打开。</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => router.push('/')} className="px-5 py-3 bg-white border border-[#E5E7EB] text-[#1F2933] rounded-lg font-semibold">
              回首页
            </button>
            <button onClick={() => router.push('/calibration')} className="px-5 py-3 bg-[#235C4E] text-white rounded-lg font-semibold">
              返回校准
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="aurora-workspace min-h-screen flex items-center justify-center p-8">
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-10 max-w-xl text-center">
          <Compass className="w-12 h-12 text-[#235C4E] mx-auto mb-5" />
          <h1 className="text-[26px] font-bold mb-3">暂无校准报告</h1>
          <p className="text-[#6B7280] mb-7">这份简历还没有可展示的报告，请先完成一次校准。</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => router.push('/')} className="px-5 py-3 bg-white border border-[#E5E7EB] text-[#1F2933] rounded-lg font-semibold">
              回首页
            </button>
            <button onClick={() => router.push('/calibration')} className="px-5 py-3 bg-[#235C4E] text-white rounded-lg font-semibold">
              去校准
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aurora-workspace min-h-screen text-[#1F2933] flex flex-col">
      <header className="h-16 bg-white border-b border-[#E5E7EB] grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center text-[#6B7280] hover:text-[#1F2933] transition-colors text-[14px] font-medium"
          >
            <Home className="w-4 h-4 mr-2" />
            回首页
          </button>
          <button
            onClick={() => router.push('/calibration')}
            className="flex items-center text-[#6B7280] hover:text-[#1F2933] transition-colors text-[14px] font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回校准
          </button>
        </div>
        <div className="flex items-center gap-2 font-semibold">
          <Compass className="w-4 h-4 text-[#235C4E]" />
          校准报告
        </div>
        <button onClick={() => goEditor()} className="px-4 py-2 bg-[#235C4E] text-white rounded-lg text-[14px] font-semibold">
          进入编辑器
        </button>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1440px] mx-auto px-8 py-8">
          <section className="bg-white border border-[#E5E7EB] rounded-lg p-7 shadow-sm mb-6">
            <div className="grid xl:grid-cols-[1fr_1.1fr_0.9fr] gap-7">
              <div>
                <div className="text-[13px] text-[#6B7280] mb-2">目标岗位</div>
                <h1 className="text-[30px] font-bold tracking-tight text-[#1F2933]">{currentResume.targetJob}</h1>
                <p className="text-[15px] text-[#6B7280] mt-2">{currentResume.title}</p>
                <div className={`inline-flex mt-5 items-center px-3 py-1.5 border rounded-lg text-[14px] font-semibold ${reportStatusClass(report.readiness.status)}`}>
                  <AlertTriangle className="w-4 h-4 mr-1.5" />
                  {report.readiness.status}
                </div>
              </div>

              <div>
                <div className="text-[13px] text-[#6B7280] mb-3">五维罗盘</div>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: '方向', score: report.radarScores.direction },
                    { label: '价值', score: report.radarScores.value },
                    { label: '清晰', score: report.radarScores.clarity },
                    { label: '证据', score: report.radarScores.evidence },
                    { label: '效率', score: report.radarScores.efficiency },
                  ].map((item) => (
                    <div key={item.label} className="bg-[#F7F8F6] border border-[#E5E7EB] rounded-lg p-4 text-center">
                      <div className="text-[26px] font-bold text-[#1F2933]">{item.score}</div>
                      <div className="text-[12px] text-[#6B7280] mt-1">{item.label}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[14px] text-[#4B5563] leading-relaxed mt-4">{report.readiness.reason}</p>
              </div>

              <div>
                <div className="text-[13px] text-[#6B7280] mb-3">主要风险</div>
                <div className="space-y-2">
                  {risks.length > 0 ? (
                    risks.map((risk, index) => (
                      <div key={`${risk}-${index}`} className="flex items-start gap-2 text-[14px] text-[#4B5563]">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#DC2626] shrink-0" />
                        <span>{risk}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[14px] text-[#6B7280]">暂无 P0 风险，建议继续处理 P1/P2 细节。</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden">
            <div className="border-b border-[#E5E7EB] px-6 pt-4">
              <div className="flex gap-2">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-[14px] font-semibold border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-[#235C4E] text-[#235C4E]'
                        : 'border-transparent text-[#6B7280] hover:text-[#1F2933]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'hits' && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-left text-[14px]">
                    <thead className="text-[#6B7280] border-b border-[#E5E7EB]">
                      <tr>
                        <th className="py-3 pr-4 font-semibold">岗位要求</th>
                        <th className="py-3 pr-4 font-semibold">简历证据</th>
                        <th className="py-3 pr-4 font-semibold">命中</th>
                        <th className="py-3 pr-4 font-semibold">补强动作</th>
                        <th className="py-3 text-right font-semibold">处理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.requirementHits.map((hit, index) => (
                        <tr key={`${hit.requirement}-${index}`} className="border-b border-[#E5E7EB]/70 last:border-0">
                          <td className="py-4 pr-4 font-semibold">{hit.requirement}</td>
                          <td className="py-4 pr-4 text-[#4B5563]">{hit.resumeEvidence}</td>
                          <td className="py-4 pr-4">
                            <span className="px-2 py-1 rounded bg-[#F7F8F6] border border-[#E5E7EB] text-[12px] font-semibold">{hit.hitLevel}</span>
                          </td>
                          <td className="py-4 pr-4 text-[#4B5563]">{hit.action}</td>
                          <td className="py-4 text-right">
                            <button onClick={() => goEditor('requirement', `requirement-${index}`)} className="text-[#235C4E] font-semibold">
                              去编辑器处理
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'evidence' && (
                <div className="grid xl:grid-cols-2 gap-4">
                  {report.evidenceChains.map((chain, index) => (
                    <button
                      key={`${chain.claim}-${index}`}
                      onClick={() => goEditor('evidence', `evidence-${index}`)}
                      className="text-left p-5 rounded-lg border border-[#E5E7EB] hover:border-[#235C4E]/40 transition-colors bg-[#F7F8F6]"
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="font-semibold text-[16px]">{chain.claim}</div>
                        <span className="px-2 py-1 rounded bg-white border border-[#E5E7EB] text-[12px] text-[#235C4E] font-semibold">{chain.strength}</span>
                      </div>
                      <p className="text-[14px] text-[#4B5563] mb-2">证据：{chain.evidence}</p>
                      <p className="text-[14px] text-[#D97706] mb-2">缺口：{chain.gap}</p>
                      <p className="text-[14px] text-[#1F2933]">建议：{chain.suggestion}</p>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'modules' && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-left text-[14px]">
                    <thead className="text-[#6B7280] border-b border-[#E5E7EB]">
                      <tr>
                        <th className="py-3 pr-4 font-semibold">模块</th>
                        <th className="py-3 pr-4 font-semibold">短板</th>
                        <th className="py-3 pr-4 font-semibold">影响</th>
                        <th className="py-3 pr-4 font-semibold">建议</th>
                        <th className="py-3 text-right font-semibold">级别</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.moduleChecks.map((item, index) => (
                        <tr key={`${item.targetModule}-${index}`} className="border-b border-[#E5E7EB]/70 last:border-0">
                          <td className="py-4 pr-4 font-semibold">{item.targetModule}</td>
                          <td className="py-4 pr-4 text-[#4B5563]">{item.shortcoming}</td>
                          <td className="py-4 pr-4 text-[#4B5563]">{item.impact}</td>
                          <td className="py-4 pr-4 text-[#1F2933]">{item.suggestion}</td>
                          <td className="py-4 text-right">
                            <button onClick={() => goEditor('module', `module-${index}`)} className="px-2 py-1 rounded bg-[#F7F8F6] border border-[#E5E7EB] text-[12px] font-bold">
                              {item.level}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'vague' && (
                <div className="grid xl:grid-cols-2 gap-4">
                  {report.vagueExpressions.map((item, index) => (
                    <button
                      key={`${item.originalText}-${index}`}
                      onClick={() => goEditor('vague', `vague-${index}`)}
                      className="text-left p-5 rounded-lg border border-[#E5E7EB] hover:border-[#235C4E]/40 transition-colors bg-[#F7F8F6]"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-1 rounded bg-white border border-[#E5E7EB] text-[12px] font-bold">{item.level}</span>
                        <span className="font-semibold text-[15px]">{item.problem}</span>
                      </div>
                      <p className="text-[14px] text-[#6B7280] line-through mb-3">{item.originalText}</p>
                      <p className="text-[14px] text-[#1F2933]">{item.replacement}</p>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  {report.tasks.map((task, index) => (
                    <button
                      key={`${task.description}-${index}`}
                      onClick={() => goEditor('task', `task-${index}`)}
                      className="w-full text-left p-4 rounded-lg border border-[#E5E7EB] hover:border-[#235C4E]/40 transition-colors flex items-start gap-4"
                    >
                      <span className="px-2 py-1 rounded bg-[#F7F8F6] border border-[#E5E7EB] text-[12px] font-bold shrink-0">{task.level}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-[15px]">{task.description}</div>
                        <div className="text-[14px] text-[#6B7280] mt-1">{task.reason}</div>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-[#235C4E]" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
