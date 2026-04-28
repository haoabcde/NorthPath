'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UploadCloud, Target, AlertTriangle, Compass, Shield, FileText, Sparkles } from 'lucide-react';
import { parseFile } from '../lib/fileParser';
import { saveCalibrationJob } from '../lib/calibrationJob';

export default function Calibration() {
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState('');
  const [jobStage, setJobStage] = useState('实习');
  const [jobDirection, setJobDirection] = useState('');
  const [customDirection, setCustomDirection] = useState('');
  const [targetJD, setTargetJD] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const stages = ['实习', '校招', '转专业', '零经验'];
  const directions = ['技术', '产品', '运营', '市场', '数据', '设计', '通用', '其他'];

  const handleFileUpload = async (file: File) => {
    setParseError('');
    setIsParsing(true);
    try {
      const text = await parseFile(file);
      if (!text) throw new Error('未能从文件中提取到文字');
      setResumeText(text);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : '解析文件时出错');
    } finally {
      setIsParsing(false);
    }
  };

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
      e.target.value = '';
    }
  };

  const handleFillExample = () => {
    setJobStage('校招');
    setJobDirection('技术');
    setJobTitle('前端开发工程师');
    setTargetJD('1. 本科及以上学历，计算机相关专业。\n2. 熟练掌握 HTML/CSS/JavaScript，熟悉 ES6+ 语法。\n3. 熟练使用 React/Vue 等主流前端框架，了解其核心原理。\n4. 有前端性能优化、工程化配置（Webpack/Vite）经验者优先。');
    setResumeText(`张三
电话：13800138000 | 邮箱：zhangsan@example.com

【教育背景】
某某大学 | 计算机科学与技术 | 本科 | 2020.09 - 2024.06

【项目经历】
校园二手交易平台（前端开发）
- 负责网站前端页面的开发，使用 React 和 React Router 搭建单页应用。
- 实现了商品的列表展示、搜索过滤和详情查看功能。
- 完成了商品发布表单的开发，并与后端接口进行了联调。

【专业技能】
- 熟练使用 HTML、CSS、JavaScript。
- 熟悉 React 框架，了解组件化开发。
- 熟悉 Git 版本控制工具。`);
  };

  const handleStart = () => {
    if (!jobTitle.trim() || !resumeText.trim()) return;
    saveCalibrationJob({
      jobTitle: jobTitle.trim(),
      jobStage,
      jobDirection: jobDirection === '其他' ? customDirection.trim() : jobDirection,
      targetJD,
      resumeText,
    });
    router.push('/calibration/progress');
  };

  return (
    <div className="aurora-workspace min-h-screen text-[#1F2933] flex flex-col font-sans">
      <header className="h-16 bg-white border-b border-[#E5E7EB] grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 shrink-0 z-10">
        <button
          onClick={() => router.push('/')}
          className="flex items-center text-[#6B7280] hover:text-[#1F2933] transition-colors text-[14px] font-medium whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          回到首页
        </button>
        <div className="justify-self-center flex items-center min-w-0">
          <Compass className="w-4 h-4 mr-2 text-[#235C4E]" />
          <span className="font-semibold text-[15px] truncate">校准简历</span>
        </div>
        <button
          onClick={handleFillExample}
          className="px-3 py-2 text-[13px] font-medium text-[#235C4E] bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg hover:bg-[#DCFCE7] transition-colors"
        >
          填入示例
        </button>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1440px] mx-auto px-8 py-8">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#235C4E]/8 text-[#235C4E] text-[13px] font-semibold mb-4">
                <Sparkles className="w-4 h-4" />
                NorthPath 五步校准
              </div>
              <h1 className="text-[32px] font-bold tracking-tight text-[#1F2933]">校准已有简历</h1>
              <p className="text-[15px] text-[#6B7280] mt-2">
                先填写岗位坐标，再上传或粘贴简历。校准过程会进入独立全屏进度页。
              </p>
            </div>
            <div className="hidden xl:flex items-center gap-3 text-[13px] text-[#6B7280]">
              <Shield className="w-4 h-4 text-[#235C4E]" />
              数据仅保存在本地浏览器
            </div>
          </div>

          <div className="grid xl:grid-cols-[0.92fr_1.08fr] gap-6">
            <section className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-7">
              <div className="flex items-center gap-3 mb-7">
                <div className="w-10 h-10 rounded-lg bg-[#235C4E]/10 text-[#235C4E] flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-[20px] font-semibold">目标岗位</h2>
                  <p className="text-[14px] text-[#6B7280] mt-1">决定报告判断标准和关键词权重</p>
                </div>
              </div>

              <div className="space-y-7">
                <div>
                  <label className="block text-[14px] font-semibold text-[#1F2933] mb-3">求职阶段</label>
                  <div className="flex flex-wrap gap-2">
                    {stages.map((stage) => (
                      <button
                        key={stage}
                        onClick={() => setJobStage(stage)}
                        className={`px-4 py-2 text-[14px] rounded-lg border transition-colors ${
                          jobStage === stage
                            ? 'bg-[#235C4E] text-white border-[#235C4E]'
                            : 'bg-white text-[#4B5563] border-[#E5E7EB] hover:border-[#235C4E]/50'
                        }`}
                      >
                        {stage}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] font-semibold text-[#1F2933] mb-3">
                    目标岗位名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="例如：前端开发实习生"
                    className="w-full p-3.5 bg-[#F7F8F6] border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#235C4E]/15 focus:border-[#235C4E] outline-none transition-all text-[15px]"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-semibold text-[#1F2933] mb-3">岗位方向</label>
                  <div className="flex flex-wrap gap-2">
                    {directions.map((dir) => (
                      <button
                        key={dir}
                        onClick={() => {
                          setJobDirection(dir);
                          if (dir !== '其他') setCustomDirection('');
                        }}
                        className={`px-4 py-2 text-[14px] rounded-lg border transition-colors ${
                          jobDirection === dir
                            ? 'bg-[#235C4E] text-white border-[#235C4E]'
                            : 'bg-white text-[#4B5563] border-[#E5E7EB] hover:border-[#235C4E]/50'
                        }`}
                      >
                        {dir}
                      </button>
                    ))}
                  </div>
                  {jobDirection === '其他' && (
                    <input
                      type="text"
                      placeholder="输入自定义方向，例如：AI 产品助理"
                      className="mt-3 w-full p-3.5 bg-[#F7F8F6] border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#235C4E]/15 focus:border-[#235C4E] outline-none transition-all text-[15px]"
                      value={customDirection}
                      onChange={(e) => setCustomDirection(e.target.value)}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[14px] font-semibold text-[#1F2933] mb-3">目标 JD（可选）</label>
                  <textarea
                    placeholder="粘贴目标岗位描述，系统将据此进行更精准的匹配分析..."
                    className="w-full p-4 bg-[#F7F8F6] border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#235C4E]/15 focus:border-[#235C4E] outline-none transition-all text-[15px] resize-none h-[220px] leading-relaxed"
                    value={targetJD}
                    onChange={(e) => setTargetJD(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-7 flex flex-col min-h-[680px]">
              <div className="flex items-center justify-between gap-4 mb-7">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#235C4E]/10 text-[#235C4E] flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-[20px] font-semibold">简历内容</h2>
                    <p className="text-[14px] text-[#6B7280] mt-1">支持 PDF / DOCX / TXT / MD</p>
                  </div>
                </div>
                <label className="text-[13px] text-[#235C4E] hover:text-[#1a453a] font-medium flex items-center cursor-pointer transition-colors bg-[#F7F8F6] px-3 py-2 rounded-lg border border-[#E5E7EB]">
                  <UploadCloud className="w-4 h-4 mr-1.5" />
                  上传文件
                  <input type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={onFileSelect} disabled={isParsing} />
                </label>
              </div>

              <div
                className={`relative flex-1 rounded-lg transition-all ${
                  isDragging ? 'ring-2 ring-[#235C4E] bg-[#E8F5E9]/50' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) await handleFileUpload(file);
                }}
              >
                <textarea
                  placeholder="请在此粘贴您的简历内容，或将文件拖拽至此处..."
                  className="w-full h-full min-h-[520px] p-5 bg-[#F7F8F6] border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#235C4E]/15 focus:border-[#235C4E] outline-none transition-all text-[15px] resize-none font-mono leading-[1.75]"
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  disabled={isParsing}
                />
                {isParsing && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center border border-[#E5E7EB] z-10">
                    <UploadCloud className="w-7 h-7 text-[#235C4E] animate-pulse mb-3" />
                    <span className="text-[14px] font-medium text-[#235C4E]">正在解析文件...</span>
                  </div>
                )}
              </div>

              {parseError && (
                <p className="mt-3 text-[14px] text-red-500 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1.5" />
                  {parseError}
                </p>
              )}

              <div className="mt-6 flex items-center justify-between gap-4">
                <p className="text-[13px] text-[#6B7280] flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#235C4E]" />
                  简历文件、校准结果和版本记录仅存储在本地浏览器。
                </p>
                <button
                  disabled={!jobTitle.trim() || !resumeText.trim()}
                  onClick={handleStart}
                  className="px-7 py-3 bg-[#235C4E] text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-[#1a453a] transition-all flex items-center justify-center shadow-sm"
                >
                  <Target className="w-5 h-5 mr-2" />
                  开始校准
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
