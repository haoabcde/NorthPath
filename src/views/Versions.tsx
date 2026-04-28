'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Download, FileText, History, RotateCcw, Trash2, Compass, ExternalLink } from 'lucide-react';
import { useResumeStore } from '../store/useResumeStore';
import type { ResumeVersion } from '../services/db';

const exportMarkdown = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function Versions() {
  const router = useRouter();
  const {
    resumes,
    allVersions,
    loadResumes,
    loadAllVersions,
    duplicateResume,
    rollbackToVersion,
    deleteResume,
    deleteVersion,
  } = useResumeStore();
  const [activeResumeId, setActiveResumeId] = useState<string>('');

  useEffect(() => {
    void loadResumes();
    void loadAllVersions();
  }, [loadAllVersions, loadResumes]);

  useEffect(() => {
    if (!activeResumeId && resumes.length > 0) {
      setActiveResumeId(resumes[0].id);
    }
  }, [activeResumeId, resumes]);

  const activeResume = resumes.find((resume) => resume.id === activeResumeId) ?? resumes[0];
  const resumeVersions = useMemo(() => {
    if (!activeResume) return [];
    return allVersions.filter((version) => version.resumeId === activeResume.id);
  }, [activeResume, allVersions]);

  const handleDuplicate = async () => {
    if (!activeResume) return;
    const label = window.prompt('给这个岗位版本起个名字，例如：产品运营版', '岗位副本');
    if (!label) return;
    const newId = await duplicateResume(activeResume.id, label);
    if (newId) router.push(`/editor/${newId}`);
  };

  const handleRollback = async (version: ResumeVersion) => {
    if (!window.confirm(`确定回滚到「${version.versionName}」吗？当前内容会保存为回滚版本。`)) return;
    await rollbackToVersion(version);
    router.push(`/editor/${version.resumeId}`);
  };

  const handleDeleteResume = async () => {
    if (!activeResume) return;
    if (!window.confirm(`确定删除「${activeResume.title}」及其所有版本和报告吗？此操作不可恢复。`)) return;
    await deleteResume(activeResume.id);
    setActiveResumeId('');
  };

  const handleDeleteVersion = async (version: ResumeVersion) => {
    if (!window.confirm(`确定删除版本「${version.versionName}」吗？`)) return;
    await deleteVersion(version.id);
  };

  return (
    <div className="aurora-workspace min-h-screen text-[#EAF6FF] font-sans">
      <header className="min-h-14 border-b border-[#45F6D0]/20 bg-[#07111F]/75 backdrop-blur-xl grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 md:px-6 py-3 sticky top-0 z-20">
        <button
          onClick={() => router.push('/')}
          className="flex items-center text-[#9EDCFF] hover:text-[#45F6D0] transition-colors text-sm font-medium whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          回到首页
        </button>
        <div className="justify-self-center flex items-center min-w-0">
          <History className="w-4 h-4 mr-2 text-[#45F6D0]" />
          <span className="font-semibold text-[14px] truncate">本地版本库</span>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => activeResume && router.push(`/editor/${activeResume.id}`)}
            disabled={!activeResume}
            className="px-3 py-1.5 rounded-lg border border-[#45F6D0]/25 text-[#45F6D0] text-[13px] disabled:opacity-40 hover:bg-[#45F6D0]/10"
          >
            打开编辑器
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 lg:py-8 grid lg:grid-cols-[320px_1fr] gap-6">
        <aside className="bg-white border border-[#45F6D0]/20 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[#45F6D0]/15 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[#EAF6FF]">简历库</h2>
              <p className="text-[12px] text-[#9EDCFF] mt-1">共 {resumes.length} 份本地简历</p>
            </div>
            <Compass className="w-5 h-5 text-[#45F6D0]" />
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {resumes.length === 0 ? (
              <div className="p-8 text-center text-[#9EDCFF] text-[13px]">暂无本地版本</div>
            ) : (
              resumes.map((resume) => (
                <button
                  key={resume.id}
                  onClick={() => setActiveResumeId(resume.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all mb-2 ${
                    activeResume?.id === resume.id
                      ? 'border-[#45F6D0]/45 bg-[#45F6D0]/10'
                      : 'border-transparent hover:border-[#9EDCFF]/20 hover:bg-[#9EDCFF]/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-[13px] text-[#EAF6FF] line-clamp-1">{resume.title}</span>
                    {resume.variantLabel && (
                      <span className="aurora-chip px-2 py-0.5 rounded text-[10px] shrink-0">{resume.variantLabel}</span>
                    )}
                  </div>
                  <div className="text-[12px] text-[#9EDCFF] mt-1 line-clamp-1">{resume.targetJob}</div>
                  <div className="text-[11px] text-[#9EDCFF]/70 mt-2">{new Date(resume.updatedAt).toLocaleString('zh-CN')}</div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="space-y-5 min-w-0">
          {activeResume ? (
            <>
              <div className="bg-white border border-[#45F6D0]/20 rounded-lg p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h1 className="text-[22px] font-semibold text-[#EAF6FF]">{activeResume.title}</h1>
                      <span className="px-2 py-1 rounded border border-[#9EDCFF]/20 text-[#9EDCFF] text-[12px]">{activeResume.source ?? 'manual'}</span>
                    </div>
                    <p className="text-[13px] text-[#9EDCFF]">
                      {activeResume.targetJob}
                      {activeResume.targetStage ? ` · ${activeResume.targetStage}` : ''}
                      {activeResume.targetDirection ? ` · ${activeResume.targetDirection}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => router.push(`/editor/${activeResume.id}`)}
                      className="px-3 py-2 rounded-lg bg-[#45F6D0] text-[#07111F] text-[13px] font-semibold flex items-center"
                    >
                      <ExternalLink className="w-4 h-4 mr-1.5" />
                      打开
                    </button>
                    <button
                      onClick={handleDuplicate}
                      className="px-3 py-2 rounded-lg border border-[#45F6D0]/25 text-[#45F6D0] text-[13px] font-medium flex items-center hover:bg-[#45F6D0]/10"
                    >
                      <Copy className="w-4 h-4 mr-1.5" />
                      复制岗位版本
                    </button>
                    <button
                      onClick={() => exportMarkdown(`${activeResume.title}.md`, activeResume.currentContent)}
                      className="px-3 py-2 rounded-lg border border-[#9EDCFF]/20 text-[#9EDCFF] text-[13px] font-medium flex items-center hover:bg-[#9EDCFF]/10"
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      导出当前
                    </button>
                    <button
                      onClick={handleDeleteResume}
                      className="px-3 py-2 rounded-lg border border-[#FF6B7A]/30 text-[#FF6B7A] text-[13px] font-medium flex items-center hover:bg-[#FF6B7A]/10"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      删除
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#45F6D0]/20 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-[#45F6D0]/15 flex items-center justify-between">
                  <div>
                    <h2 className="text-[16px] font-semibold text-[#EAF6FF]">版本记录</h2>
                    <p className="text-[12px] text-[#9EDCFF] mt-1">{resumeVersions.length} 条可回滚版本</p>
                  </div>
                  <FileText className="w-5 h-5 text-[#45F6D0]" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-[13px]">
                    <thead className="bg-[#07111F]/70 text-[#9EDCFF]">
                      <tr>
                        <th className="p-4 font-medium">版本</th>
                        <th className="p-4 font-medium">来源</th>
                        <th className="p-4 font-medium">备注</th>
                        <th className="p-4 font-medium">时间</th>
                        <th className="p-4 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumeVersions.map((version, index) => (
                        <tr key={version.id} className="border-t border-[#45F6D0]/10">
                          <td className="p-4 text-[#EAF6FF] font-medium">
                            {version.versionName}
                            {index === 0 && <span className="ml-2 aurora-chip px-2 py-0.5 rounded text-[10px]">最新</span>}
                          </td>
                          <td className="p-4 text-[#9EDCFF]">{version.source ?? 'manual'}</td>
                          <td className="p-4 text-[#9EDCFF] max-w-[260px]">
                            <span className="line-clamp-2">{version.notes || '-'}</span>
                          </td>
                          <td className="p-4 text-[#9EDCFF]">{new Date(version.savedAt).toLocaleString('zh-CN')}</td>
                          <td className="p-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleRollback(version)}
                                className="p-2 rounded border border-[#45F6D0]/25 text-[#45F6D0] hover:bg-[#45F6D0]/10"
                                title="回滚"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => exportMarkdown(`${activeResume.title}-${version.versionName}.md`, version.content)}
                                className="p-2 rounded border border-[#9EDCFF]/20 text-[#9EDCFF] hover:bg-[#9EDCFF]/10"
                                title="导出"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteVersion(version)}
                                className="p-2 rounded border border-[#FF6B7A]/30 text-[#FF6B7A] hover:bg-[#FF6B7A]/10"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-[#45F6D0]/20 rounded-lg p-10 text-center">
              <History className="w-10 h-10 mx-auto text-[#45F6D0] mb-4" />
              <h1 className="text-[20px] font-semibold text-[#EAF6FF] mb-2">还没有本地版本</h1>
              <p className="text-[13px] text-[#9EDCFF] mb-6">先制作或校准一份简历，版本库会自动记录每次关键修改。</p>
              <button
                onClick={() => router.push('/builder')}
                className="px-4 py-2 rounded-lg bg-[#45F6D0] text-[#07111F] text-[13px] font-semibold"
              >
                开始制作
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
