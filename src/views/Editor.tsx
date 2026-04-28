'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save, FileDown, FileText, RefreshCw, ChevronRight, CheckCircle2, Wand2, AlertTriangle, Sparkles, Compass, History, XCircle, Bold, List, Heading, Minus, LineChart, FileCode, Shield, PanelRightOpen, Download, X, Home } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useResumeStore } from '../store/useResumeStore';
import type { CalibrationReport } from '../services/db';
import { buildCalibrationReport, reportStatusClass } from '../lib/report';
import { runCalibrationPipeline } from '../lib/calibrationPipeline';
import JobWritingMapPanel from '../components/JobWritingMapPanel';
import ResumeOutline from '../components/ResumeOutline';
import { buildOutline } from '../lib/resumeOutline';
import { RESUME_TEMPLATES, getTemplateClassName, type ResumeTemplateId } from '../lib/templates';
import { exportDocx } from '../lib/docxExport';
import { estimatePdfPages } from '../lib/pageEstimate';
import { buildAnalysisAnchors, type AnalysisAnchor, type AnalysisAnchorType } from '../lib/analysisAnchors';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type AnalysisTab = 'suggestions' | 'hits' | 'evidence' | 'vague' | 'tasks' | 'trajectory';

export default function Editor({ resumeId }: { resumeId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    currentResume,
    loadResume,
    updateResumeContent,
    report,
    createVersion,
    versions,
    optimizationEvents,
    isLoading,
    applySuggestion,
    rollbackToVersion,
    updateSuggestionStatus,
    updateResumeTemplate,
  } = useResumeStore();
  
  const [content, setContent] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isCheckingPage, setIsCheckingPage] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [hasLoadedResume, setHasLoadedResume] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<AnalysisTab>('suggestions');
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outline = useMemo(() => buildOutline(content), [content]);
  const [collapsedLines, setCollapsedLines] = useState<number[]>([]);

  const toggleCollapsedLine = (line: number) => {
    setCollapsedLines((prev) => (prev.includes(line) ? prev.filter((l) => l !== line) : [...prev, line]));
  };

  const previewMarkdown = useMemo(() => {
    if (outline.length === 0 || collapsedLines.length === 0) return content;
    const lines = content.split('\n');
    const collapsed = new Set(collapsedLines);
    const nextHeadingLine = (currentLine: number) => outline.find((o) => o.line > currentLine)?.line ?? lines.length + 1;

    const out: string[] = [];
    let i = 1;
    while (i <= lines.length) {
      out.push(lines[i - 1]);
      if (collapsed.has(i)) {
        out.push('> （已折叠）');
        i = nextHeadingLine(i);
        continue;
      }
      i += 1;
    }
    return out.join('\n');
  }, [content, outline, collapsedLines]);

  useEffect(() => {
    let isMounted = true;

    if (!resumeId) {
      setHasLoadedResume(true);
      return undefined;
    }

    setHasLoadedResume(false);
    void loadResume(resumeId).finally(() => {
      if (isMounted) {
        setHasLoadedResume(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [resumeId, loadResume]);

  useEffect(() => {
    if (currentResume) {
      setContent(currentResume.currentContent);
    }
  }, [currentResume]);

  const [showVersions, setShowVersions] = useState(false);
  const analysisAnchors = useMemo(() => buildAnalysisAnchors(content, report), [content, report]);
  const lineMarkers = useMemo(() => {
    const markers: Record<number, Array<{ id: string; type: AnalysisAnchorType; level: 'P0' | 'P1' | 'P2' }>> = {};
    analysisAnchors.forEach((anchor) => {
      if (!anchor.lineNumber || !anchor.level) return;
      if (anchor.type === 'suggestion' && anchor.status !== 'pending' && anchor.status !== 'snoozed') return;
      markers[anchor.lineNumber] = [
        ...(markers[anchor.lineNumber] ?? []),
        { id: anchor.id, type: anchor.type, level: anchor.level },
      ];
    });
    return markers;
  }, [analysisAnchors]);

  const suggestionGroups = useMemo(() => {
    if (!report) return null;
    const all = report.suggestions ?? [];
    return {
      pending: all.filter((s) => s.status === 'pending'),
      snoozed: all.filter((s) => s.status === 'snoozed'),
      done: all.filter((s) => s.status === 'done'),
      ignored: all.filter((s) => s.status === 'ignored'),
      applied: all.filter((s) => s.status === 'applied'),
    };
  }, [report]);

  const handleSave = async () => {
    await updateResumeContent(content);
    await createVersion(`手动保存 - ${new Date().toLocaleTimeString('zh-CN')}`, {
      source: 'manual',
    });
  };

  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationLabel, setCalibrationLabel] = useState('');

  const handleRecalibrate = async () => {
    setIsCalibrating(true);
    setCalibrationLabel('');
    await handleSave(); // auto-save before recalibrating
    
    try {
      const aiReport = await runCalibrationPipeline(
        {
          jobTitle: currentResume?.targetJob || '未知',
          jobStage: currentResume?.targetStage || '实习',
          jobDirection: currentResume?.targetDirection || '通用',
          targetJD: '',
          resumeText: content,
        },
        (p) => {
          setCalibrationLabel(`${p.title}${p.stats ? ` · ${Object.entries(p.stats).map(([k, v]) => `${k}:${v}`).join(' ')}` : ''}`);
        },
      );
      
      const { setReport } = useResumeStore.getState();
      const newReport = buildCalibrationReport(aiReport, resumeId);
      
      await setReport(newReport);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : '重新校准过程中发生错误');
    } finally {
      setCalibrationLabel('');
      setIsCalibrating(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById('resume-export');
      if (!element) return;

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let remainingHeight = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      remainingHeight -= pageHeight;

      while (remainingHeight > 0) {
        position = remainingHeight - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        remainingHeight -= pageHeight;
      }

      pdf.save(`${currentResume?.title || 'resume'}.pdf`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : '导出 PDF 时发生错误');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDocx = async () => {
    if (!currentResume) return;
    setIsExportingDocx(true);
    try {
      await exportDocx(content, `${currentResume.title}.docx`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : '导出 DOCX 时发生错误');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleOnePageCheck = async () => {
    setIsCheckingPage(true);
    try {
      const element = document.getElementById('resume-export');
      if (!element) return;
      const canvas = await html2canvas(element, { scale: 1, useCORS: true, backgroundColor: '#ffffff' });
      const pdfWidth = 210;
      const pageHeight = 297;
      const pages = estimatePdfPages({
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        pdfWidth,
        pageHeight,
      });
      if (pages <= 1) {
        alert('一页纸检测：通过（导出 PDF 预计 1 页）');
      } else {
        alert(`一页纸检测：未通过（导出 PDF 预计 ${pages} 页）`);
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : '一页纸检测失败');
    } finally {
      setIsCheckingPage(false);
    }
  };

  const handleExportMD = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentResume?.title || 'resume'}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = content.substring(start, end);
    const newText = content.substring(0, start) + prefix + text + suffix + content.substring(end);
    setContent(newText);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + prefix.length, end + prefix.length);
      }
    }, 0);
  };

  const jumpToLine = useCallback((line: number) => {
    if (!textareaRef.current) return;
    const lines = content.split('\n');
    const pos = lines.slice(0, Math.max(0, line - 1)).join('\n').length + (line > 1 ? 1 : 0);
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(pos, pos);
    textareaRef.current.scrollTop = Math.max(0, (line - 4) * 24);
  }, [content]);

  const tabForAnchorType = useCallback((type: AnalysisAnchorType): AnalysisTab => {
    if (type === 'requirement') return 'hits';
    if (type === 'evidence') return 'evidence';
    if (type === 'vague') return 'vague';
    if (type === 'task' || type === 'module') return 'tasks';
    return 'suggestions';
  }, []);

  const selectAnalysisAnchor = useCallback((anchor: AnalysisAnchor) => {
    setIsAnalysisOpen(true);
    setActiveAnalysisTab(tabForAnchorType(anchor.type));
    if (anchor.type === 'suggestion') setActiveSuggestion(anchor.id);
    if (anchor.lineNumber) {
      jumpToLine(anchor.lineNumber);
      setHighlightedLine(anchor.lineNumber);
      window.setTimeout(() => setHighlightedLine(null), 1400);
    }
  }, [jumpToLine, tabForAnchorType]);

  useEffect(() => {
    const analysis = searchParams.get('analysis') as AnalysisAnchorType | null;
    const target = searchParams.get('target');
    if (!analysis || !target || analysisAnchors.length === 0) return;
    const anchor = analysisAnchors.find((item) => item.type === analysis && item.id === target);
    if (anchor) selectAnalysisAnchor(anchor);
  }, [analysisAnchors, searchParams, selectAnalysisAnchor]);

  const [confirmSuggestion, setConfirmSuggestion] = useState<CalibrationReport['suggestions'][number] | null>(null);

  const handleApplySuggestion = async (suggestion: CalibrationReport['suggestions'][number], confirmed = false) => {
    if (!currentResume) return;

    if (!suggestion.originalText.trim() || !suggestion.replacementText.trim()) {
      alert('这条建议缺少可定位的原文或替换文本，请手动参考建议修改。');
      return;
    }

    if (!confirmed && (suggestion.missingInfo || suggestion.riskWarning || suggestion.needsConfirmation)) {
      setConfirmSuggestion(suggestion);
      return;
    }

    if (content.includes(suggestion.originalText)) {
      const newContent = content.replace(suggestion.originalText, suggestion.replacementText);
      if (currentResume.currentContent !== content) {
        await updateResumeContent(content);
      }
      await applySuggestion(suggestion);
      setContent(newContent);
      setActiveSuggestion(null);
    } else {
      alert("找不到原文，可能已被修改。");
    }
  };

  const suggestionStatusBadge = (status: CalibrationReport['suggestions'][number]['status']) => {
    if (status === 'applied') return { label: '已应用', cls: 'border-[#45F6D0]/30 text-[#45F6D0] bg-[#45F6D0]/10' };
    if (status === 'ignored') return { label: '已忽略', cls: 'border-[#9EDCFF]/20 text-[#9EDCFF] bg-[#9EDCFF]/10' };
    if (status === 'done') return { label: '已完成', cls: 'border-[#F6D86B]/30 text-[#F6D86B] bg-[#F6D86B]/10' };
    if (status === 'snoozed') return { label: '稍后处理', cls: 'border-[#E5E7EB] text-[#6B7280] bg-[#F7F8F6]' };
    return { label: '待处理', cls: 'border-[#FF6B7A]/25 text-[#FF6B7A] bg-[#FF6B7A]/10' };
  };

  const renderSuggestionCard = (suggestion: CalibrationReport['suggestions'][number]) => {
    const badge = suggestionStatusBadge(suggestion.status);
    return (
      <div
        key={suggestion.id}
        className={`border rounded-lg overflow-hidden transition-all ${
          activeSuggestion === suggestion.id ? 'border-[#235C4E] shadow-sm' : 'border-[#E5E7EB] bg-white hover:border-[#235C4E]/50'
        }`}
      >
        <button
          className="w-full p-3 flex items-center justify-between bg-white text-left text-[13px] font-medium"
          onClick={() => {
            const anchor = analysisAnchors.find((item) => item.type === 'suggestion' && item.id === suggestion.id);
            if (anchor) selectAnalysisAnchor(anchor);
            setActiveSuggestion(activeSuggestion === suggestion.id ? null : suggestion.id);
          }}
        >
          <span className="truncate pr-4 text-[#1F2933]">{suggestion.shortcoming}</span>
          <span className={`mr-2 px-2 py-0.5 rounded text-[10px] border ${badge.cls}`}>{badge.label}</span>
          <ChevronRight
            className={`w-4 h-4 shrink-0 transition-transform ${
              activeSuggestion === suggestion.id ? 'rotate-90 text-[#235C4E]' : 'text-[#6B7280]'
            }`}
          />
        </button>

        {activeSuggestion === suggestion.id && (
          <div className="p-4 bg-[#F7F8F6] border-t border-[#E5E7EB] text-[13px] space-y-4">
            <div>
              <span className="text-[11px] font-semibold text-[#6B7280] block mb-1.5 uppercase tracking-wider">内容短板</span>
              <p className="bg-white border border-[#E5E7EB] text-[#6B7280] p-2.5 rounded-md leading-relaxed">{suggestion.shortcoming}</p>
            </div>

            {suggestion.suggestion && (
              <div>
                <span className="text-[11px] font-semibold text-[#235C4E] block mb-1.5 uppercase tracking-wider flex items-center">
                  <Wand2 className="w-3 h-3 mr-1" /> 修正建议
                </span>
                <p className="bg-[#F0FDF4] text-[#1F2933] p-2.5 rounded-md border border-[#BBF7D0] leading-relaxed">
                  {suggestion.suggestion}
                </p>
              </div>
            )}

            <div>
              <span className="text-[11px] font-semibold text-[#235C4E] block mb-1.5 uppercase tracking-wider flex items-center">
                <Sparkles className="w-3 h-3 mr-1" /> 可替换表达
              </span>
              <p className="bg-white border border-[#E5E7EB] text-[#1F2933] p-2.5 rounded-md leading-relaxed">{suggestion.replacementText}</p>
            </div>

            {suggestion.missingInfo && (
              <div>
                <span className="text-[11px] font-semibold text-[#D97706] block mb-1.5 uppercase tracking-wider">待补充信息</span>
                <p className="bg-[#FFFBEB] text-[#D97706] p-2.5 rounded-md border border-[#FDE68A] leading-relaxed">
                  {suggestion.missingInfo}
                </p>
              </div>
            )}

            {suggestion.riskWarning && (
              <div>
                <span className="text-[11px] font-semibold text-[#DC2626] block mb-1.5 uppercase tracking-wider flex items-center">
                  <AlertTriangle className="w-3 h-3 mr-1" /> 风险提示
                </span>
                <p className="bg-[#FEF2F2] text-[#DC2626] p-2.5 rounded-md border border-[#FECACA] leading-relaxed">
                  {suggestion.riskWarning}
                </p>
              </div>
            )}

            {suggestion.needsConfirmation && (
              <div className="text-[12px] text-[#D97706] bg-[#FFFBEB] p-2.5 rounded-md border border-[#FDE68A] flex items-start">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5 shrink-0 mt-0.5" />
                <span>{suggestion.needsConfirmation}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleApplySuggestion(suggestion)}
                className="col-span-2 py-2 bg-[#235C4E] text-white rounded-md text-[13px] font-medium hover:bg-[#1a453a] transition-colors flex items-center justify-center shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> 一键应用替换
              </button>
              <button
                onClick={() => updateSuggestionStatus(suggestion.id, 'done')}
                className="py-2 bg-white border border-[#E5E7EB] text-[#1F2933] rounded-md text-[13px] font-medium hover:bg-[#F7F8F6] transition-colors"
              >
                完成
              </button>
              <button
                onClick={() => updateSuggestionStatus(suggestion.id, 'snoozed')}
                className="py-2 bg-white border border-[#E5E7EB] text-[#1F2933] rounded-md text-[13px] font-medium hover:bg-[#F7F8F6] transition-colors"
              >
                稍后处理
              </button>
              <button
                onClick={() => updateSuggestionStatus(suggestion.id, 'ignored')}
                className="col-span-2 py-2 bg-white border border-[#E5E7EB] text-[#6B7280] rounded-md text-[13px] font-medium hover:bg-[#F7F8F6] transition-colors"
              >
                忽略
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!currentResume && (!hasLoadedResume || isLoading)) {
    return (
      <div className="aurora-page min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#235C4E] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!currentResume) {
    return (
      <div className="aurora-page min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center border border-[#E5E7EB] mx-auto mb-5 shadow-sm">
            <AlertTriangle className="w-7 h-7 text-[#D97706]" />
          </div>
          <h1 className="text-[20px] font-bold text-[#1F2933] mb-2">未找到这份简历</h1>
          <p className="text-[14px] text-[#6B7280] leading-relaxed mb-6">
            这份简历可能已被清除，或当前浏览器没有对应的本地版本记录。
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2.5 bg-[#235C4E] text-white text-[14px] font-medium rounded-lg hover:bg-[#1a453a] transition-colors shadow-sm"
          >
            回到首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="aurora-editor h-screen text-[#EAF6FF] flex flex-col font-sans overflow-hidden relative">
      
      {/* Mobile Block Overlay */}
      <div className="lg:hidden absolute inset-0 bg-[#07111F] z-50 flex flex-col p-4">
        <div className="bg-[#0B1728] border border-[#45F6D0]/20 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#F6D86B] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-[16px] font-bold text-[#EAF6FF] mb-1">移动端预览模式</h2>
              <p className="text-[13px] text-[#9EDCFF] leading-relaxed">
                手机端可查看当前简历和校准建议；完整 Markdown 编辑、行级定位和 PDF 导出建议在桌面浏览器完成。
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-[#45F6D0] text-[#07111F] text-[13px] font-semibold rounded-lg"
            >
              返回首页
            </button>
            <button
              onClick={() => router.push('/versions')}
              className="px-4 py-2 border border-[#45F6D0]/30 text-[#45F6D0] text-[13px] font-medium rounded-lg"
            >
              版本库
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-[#EAF6FF] rounded-lg p-4">
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="min-h-14 bg-white border-b border-[#E5E7EB] items-center justify-between gap-4 px-4 xl:px-6 py-2 shrink-0 z-10 shadow-sm hidden lg:flex">
        <div className="flex items-center min-w-0">
          <button 
            onClick={() => router.push('/')} 
            className="flex items-center text-[#6B7280] hover:text-[#1F2933] transition-colors text-[13px] font-medium mr-4"
          >
            <Home className="w-4 h-4 mr-1.5" />
            回首页
          </button>
          <div className="h-4 w-[1px] bg-[#E5E7EB] mx-2"></div>
          <div className="flex items-center ml-2 min-w-0">
            <Compass className="w-4 h-4 text-[#235C4E] mr-2" />
            <h1 className="font-semibold text-[14px] text-[#1F2933] mr-3 truncate">{currentResume.title}</h1>
            <span className="text-[12px] text-[#6B7280] bg-[#F7F8F6] px-2 py-0.5 rounded border border-[#E5E7EB]">
              已保存
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 xl:gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded border border-[#E5E7EB] text-[13px]">
            <span className="text-[#6B7280] font-medium">模板</span>
            <select
              value={((currentResume?.templateId as ResumeTemplateId) || 'classic') as ResumeTemplateId}
              onChange={(e) => updateResumeTemplate(e.target.value)}
              className="bg-transparent outline-none text-[#1F2933] font-medium"
            >
              {RESUME_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setIsAnalysisOpen(true)}
            className="flex items-center px-3 py-1.5 bg-white text-[#235C4E] rounded border border-[#235C4E] text-[13px] font-medium hover:bg-[#F0FDF4] transition-colors shadow-sm"
          >
            <PanelRightOpen className="w-3.5 h-3.5 mr-1.5" /> 简历分析
          </button>
          <button 
            onClick={() => setShowVersions(!showVersions)}
            className="flex items-center px-3 py-1.5 bg-white text-[#1F2933] rounded border border-[#E5E7EB] text-[13px] font-medium hover:bg-[#F7F8F6] transition-colors shadow-sm"
          >
            <History className="w-3.5 h-3.5 mr-1.5 text-[#6B7280]" /> 版本库
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center px-3 py-1.5 bg-white text-[#1F2933] rounded border border-[#E5E7EB] text-[13px] font-medium hover:bg-[#F7F8F6] transition-colors shadow-sm"
          >
            <Save className="w-3.5 h-3.5 mr-1.5 text-[#6B7280]" /> 保存版本
          </button>
          <button 
            onClick={handleRecalibrate}
            disabled={isCalibrating}
            className="flex items-center px-3 py-1.5 bg-white text-[#1F2933] rounded border border-[#E5E7EB] text-[13px] font-medium hover:bg-[#F7F8F6] transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-[#6B7280] ${isCalibrating ? 'animate-spin' : ''}`} /> 
            {isCalibrating ? (calibrationLabel ? calibrationLabel : '校准中...') : '重新校准'}
          </button>
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen((open) => !open)}
              className="flex items-center px-4 py-1.5 bg-[#235C4E] text-white rounded text-[13px] font-medium hover:bg-[#1a453a] transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> 导出
            </button>
            {isExportMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-44 bg-white border border-[#E5E7EB] rounded-lg shadow-xl p-1 z-50">
                <button onClick={handleExportMD} className="w-full flex items-center gap-2 px-3 py-2 rounded text-[13px] text-[#1F2933] hover:bg-[#F7F8F6]">
                  <FileCode className="w-4 h-4 text-[#6B7280]" /> 导出 MD
                </button>
                <button onClick={handleExportDocx} disabled={isExportingDocx} className="w-full flex items-center gap-2 px-3 py-2 rounded text-[13px] text-[#1F2933] hover:bg-[#F7F8F6] disabled:opacity-50">
                  <FileText className="w-4 h-4 text-[#6B7280]" /> {isExportingDocx ? '导出中...' : '导出 DOCX'}
                </button>
                <button onClick={handleExportPDF} disabled={isExporting} className="w-full flex items-center gap-2 px-3 py-2 rounded text-[13px] text-[#1F2933] hover:bg-[#F7F8F6] disabled:opacity-50">
                  <FileDown className="w-4 h-4 text-[#6B7280]" /> {isExporting ? '导出中...' : '导出 PDF'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 overflow-x-auto relative hidden lg:block">
        <div className="h-full min-w-[1360px] grid grid-cols-[minmax(560px,42%)_minmax(760px,58%)]">
        {/* Editor Column */}
        <div className="min-w-[560px] flex flex-col border-r border-[#E5E7EB] bg-white">
          <div className="h-11 bg-[#F7F8F6] border-b border-[#E5E7EB] flex items-center justify-between px-4 shrink-0">
            <span className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wider">Markdown 编辑区</span>
            <div className="flex items-center space-x-1">
              <button onClick={() => insertMarkdown('**', '**')} className="p-1 hover:bg-[#E5E7EB] rounded text-[#6B7280]" title="加粗">
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => insertMarkdown('- ')} className="p-1 hover:bg-[#E5E7EB] rounded text-[#6B7280]" title="列表">
                <List className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => insertMarkdown('### ')} className="p-1 hover:bg-[#E5E7EB] rounded text-[#6B7280]" title="标题">
                <Heading className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => insertMarkdown('\n---\n')} className="p-1 hover:bg-[#E5E7EB] rounded text-[#6B7280]" title="分割线">
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex overflow-hidden relative">
            <div className="w-16 bg-[#F7F8F6] border-r border-[#E5E7EB] flex flex-col items-center py-5 text-[12px] font-mono text-[#9CA3AF] select-none overflow-hidden h-full">
              <div style={{ transform: `translateY(-${scrollTop}px)` }} className="w-full">
                {content.split('\n').map((_, i) => {
                  const marker = lineMarkers[i + 1]?.[0];
                  return (
                    <div key={i} className={`leading-relaxed h-6 flex items-center justify-center gap-1 w-full ${highlightedLine === i + 1 ? 'bg-[#F6D86B]/20' : ''}`}>
                      <span className="w-5 text-right">{i + 1}</span>
                      {marker ? (
                        <button
                          type="button"
                          onClick={() => {
                            const anchor = analysisAnchors.find((item) => item.id === marker.id && item.type === marker.type);
                            if (anchor) selectAnalysisAnchor(anchor);
                          }}
                          className={`text-[9px] px-1 py-0.5 rounded border leading-none ${
                            marker.level === 'P0'
                              ? 'border-[#FF6B7A]/40 text-[#FF6B7A] bg-[#FF6B7A]/10'
                              : marker.level === 'P1'
                                ? 'border-[#F6D86B]/40 text-[#F6D86B] bg-[#F6D86B]/10'
                                : 'border-[#9EDCFF]/30 text-[#9EDCFF] bg-[#9EDCFF]/10'
                          }`}
                          title={`定位 ${marker.level} 建议`}
                        >
                          {marker.level}
                        </button>
                      ) : (
                        <span className="w-6" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
              className="flex-1 w-full p-6 bg-transparent outline-none resize-none font-mono text-[15px] leading-6 text-[#1F2933] overflow-y-auto whitespace-pre"
              style={{ lineHeight: '24px' }}
              spellCheck={false}
              wrap="off"
            />
          </div>
        </div>

        {/* Preview Column */}
        <div className="min-w-[760px] flex flex-col bg-[#F7F8F6]">
          <div className="h-11 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-5 shrink-0">
            <span className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wider">实时渲染预览</span>
            <button
              onClick={handleOnePageCheck}
              disabled={isCheckingPage}
              className="flex items-center px-3 py-1.5 bg-white text-[#1F2933] rounded border border-[#E5E7EB] text-[13px] font-medium hover:bg-[#F7F8F6] transition-colors disabled:opacity-50"
            >
              <Shield className={`w-3.5 h-3.5 mr-1.5 text-[#6B7280] ${isCheckingPage ? 'animate-pulse' : ''}`} /> 一页纸检测
            </button>
          </div>
          <div className="flex-1 overflow-auto p-8">
            <div 
              id="resume-preview" 
              className={`bg-white border border-[#E5E7EB] rounded-lg w-full min-h-full p-8 markdown-body web-editor-preview ${
                getTemplateClassName((currentResume?.templateId as ResumeTemplateId) || 'classic')
              }`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {previewMarkdown}
              </ReactMarkdown>
            </div>
            <div className="fixed left-[-99999px] top-0">
              <div
                id="resume-export"
                className={`bg-white shadow-md border border-[#E5E7EB] w-[210mm] min-h-[297mm] p-[10mm] markdown-body ${
                  getTemplateClassName((currentResume?.templateId as ResumeTemplateId) || 'classic')
                }`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
        </div>

        {isAnalysisOpen && (
          <div className="absolute inset-y-0 right-0 w-[520px] bg-white border-l border-[#E5E7EB] shadow-2xl z-30 flex flex-col">
            <div className="h-14 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-5 shrink-0">
              <div>
                <div className="text-[15px] font-semibold text-[#1F2933] flex items-center">
                  <Wand2 className="w-4 h-4 mr-2 text-[#235C4E]" />
                  简历分析
                </div>
                {report && <div className="text-[12px] text-[#6B7280] mt-0.5">{report.readiness.status}</div>}
              </div>
              <button onClick={() => setIsAnalysisOpen(false)} className="p-1.5 rounded hover:bg-[#F7F8F6] text-[#6B7280]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {report ? (
              <>
                <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#F7F8F6] flex gap-2 overflow-x-auto">
                  {[
                    ['suggestions', '建议'],
                    ['hits', '命中'],
                    ['evidence', '证据'],
                    ['vague', '空泛'],
                    ['tasks', '任务'],
                    ['trajectory', '轨迹'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setActiveAnalysisTab(id as typeof activeAnalysisTab)}
                      className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold border whitespace-nowrap ${
                        activeAnalysisTab === id
                          ? 'bg-white border-[#235C4E] text-[#235C4E]'
                          : 'bg-transparent border-transparent text-[#6B7280] hover:text-[#1F2933]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-5 text-[14px]">
                  {activeAnalysisTab === 'suggestions' && suggestionGroups && (
                    <div className="space-y-5">
                      <div className={`p-4 rounded-lg border ${reportStatusClass(report.readiness.status)}`}>
                        <div className="font-semibold mb-1">投递准备度：{report.readiness.status}</div>
                        <p className="text-[13px] leading-relaxed opacity-90">{report.readiness.reason}</p>
                      </div>
                      {outline.length > 0 && (
                        <ResumeOutline
                          markdown={content}
                          onJumpToLine={jumpToLine}
                          collapsedLines={collapsedLines}
                          onToggleLine={toggleCollapsedLine}
                        />
                      )}
                      {suggestionGroups.pending.length > 0 && (
                        <div>
                          <div className="text-[14px] font-semibold text-[#1F2933] mb-3">待处理建议 ({suggestionGroups.pending.length})</div>
                          <div className="space-y-3">{suggestionGroups.pending.map(renderSuggestionCard)}</div>
                        </div>
                      )}
                      {suggestionGroups.snoozed.length > 0 && (
                        <div>
                          <div className="text-[14px] font-semibold text-[#1F2933] mb-3">稍后处理 ({suggestionGroups.snoozed.length})</div>
                          <div className="space-y-3">{suggestionGroups.snoozed.map(renderSuggestionCard)}</div>
                        </div>
                      )}
                      {[...suggestionGroups.done, ...suggestionGroups.applied, ...suggestionGroups.ignored].length > 0 && (
                        <div>
                          <div className="text-[14px] font-semibold text-[#1F2933] mb-3">已处理</div>
                          <div className="space-y-3">
                            {[...suggestionGroups.done, ...suggestionGroups.applied, ...suggestionGroups.ignored].map(renderSuggestionCard)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeAnalysisTab === 'hits' && (
                    <div className="space-y-3">
                      {report.requirementHits.map((hit, index) => (
                        <button
                          key={`${hit.requirement}-${index}`}
                          onClick={() => {
                            const anchor = analysisAnchors.find((item) => item.type === 'requirement' && item.id === `requirement-${index}`);
                            if (anchor) selectAnalysisAnchor(anchor);
                          }}
                          className="w-full text-left p-4 rounded-lg border border-[#E5E7EB] hover:border-[#235C4E]/40 bg-[#F7F8F6]"
                        >
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <span className="font-semibold text-[#1F2933]">{hit.requirement}</span>
                            <span className="px-2 py-0.5 rounded bg-white border border-[#E5E7EB] text-[12px] text-[#235C4E]">{hit.hitLevel}</span>
                          </div>
                          <p className="text-[#6B7280] mb-2">{hit.resumeEvidence}</p>
                          <p className="text-[#1F2933]">{hit.action}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {activeAnalysisTab === 'evidence' && (
                    <div className="space-y-3">
                      {report.evidenceChains.map((chain, index) => (
                        <button
                          key={`${chain.claim}-${index}`}
                          onClick={() => {
                            const anchor = analysisAnchors.find((item) => item.type === 'evidence' && item.id === `evidence-${index}`);
                            if (anchor) selectAnalysisAnchor(anchor);
                          }}
                          className="w-full text-left p-4 rounded-lg border border-[#E5E7EB] hover:border-[#235C4E]/40 bg-[#F7F8F6]"
                        >
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <span className="font-semibold text-[#1F2933]">{chain.claim}</span>
                            <span className="px-2 py-0.5 rounded bg-white border border-[#E5E7EB] text-[12px] text-[#235C4E]">{chain.strength}</span>
                          </div>
                          <p className="text-[#6B7280] mb-2">证据：{chain.evidence}</p>
                          <p className="text-[#D97706] mb-2">缺口：{chain.gap}</p>
                          <p className="text-[#1F2933]">建议：{chain.suggestion}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {activeAnalysisTab === 'vague' && (
                    <div className="space-y-3">
                      {report.vagueExpressions.map((item, index) => (
                        <button
                          key={`${item.originalText}-${index}`}
                          onClick={() => {
                            const anchor = analysisAnchors.find((anchorItem) => anchorItem.type === 'vague' && anchorItem.id === `vague-${index}`);
                            if (anchor) selectAnalysisAnchor(anchor);
                          }}
                          className="w-full text-left p-4 rounded-lg border border-[#E5E7EB] hover:border-[#235C4E]/40 bg-[#F7F8F6]"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded bg-white border border-[#E5E7EB] text-[12px] font-bold">{item.level}</span>
                            <span className="font-semibold text-[#1F2933]">{item.problem}</span>
                          </div>
                          <p className="text-[#6B7280] line-through mb-2">{item.originalText}</p>
                          <p className="text-[#1F2933]">{item.replacement}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {activeAnalysisTab === 'tasks' && (
                    <div className="space-y-3">
                      {report.tasks.map((task, index) => (
                        <button
                          key={`${task.description}-${index}`}
                          onClick={() => {
                            const anchor = analysisAnchors.find((item) => item.type === 'task' && item.id === `task-${index}`);
                            if (anchor) selectAnalysisAnchor(anchor);
                          }}
                          className="w-full text-left p-4 rounded-lg border border-[#E5E7EB] hover:border-[#235C4E]/40 bg-white flex items-start gap-3"
                        >
                          <span className="px-2 py-0.5 rounded bg-[#F7F8F6] border border-[#E5E7EB] text-[12px] font-bold shrink-0">{task.level}</span>
                          <span>
                            <span className="block font-semibold text-[#1F2933]">{task.description}</span>
                            <span className="block text-[#6B7280] mt-1">{task.reason}</span>
                          </span>
                        </button>
                      ))}
                      {currentResume.jobWritingMap && (
                        <div className="mt-6 bg-[#235C4E]/5 p-4 rounded-lg border border-[#235C4E]/10">
                          <JobWritingMapPanel map={currentResume.jobWritingMap} />
                        </div>
                      )}
                    </div>
                  )}

                  {activeAnalysisTab === 'trajectory' && (
                    <div className="space-y-5">
                      <button
                        onClick={() => setShowOptimizationModal(true)}
                        className="w-full p-4 rounded-lg border border-[#235C4E] text-[#235C4E] font-semibold flex items-center justify-center gap-2"
                      >
                        <LineChart className="w-4 h-4" />
                        打开完整优化轨迹
                      </button>
                      <button
                        onClick={handleOnePageCheck}
                        disabled={isCheckingPage}
                        className="w-full p-4 rounded-lg border border-[#E5E7EB] text-[#1F2933] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Shield className="w-4 h-4" />
                        一页纸检测
                      </button>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-[#F7F8F6] rounded-lg text-center">
                          <div className="text-[24px] font-bold text-[#235C4E]">{optimizationEvents.length}</div>
                          <div className="text-[12px] text-[#6B7280]">修改记录</div>
                        </div>
                        <div className="p-3 bg-[#F7F8F6] rounded-lg text-center">
                          <div className="text-[24px] font-bold text-[#235C4E]">{report.suggestions.filter((s) => s.status === 'applied').length}</div>
                          <div className="text-[12px] text-[#6B7280]">已应用</div>
                        </div>
                        <div className="p-3 bg-[#F7F8F6] rounded-lg text-center">
                          <div className="text-[24px] font-bold text-[#D97706]">{report.suggestions.filter((s) => s.status === 'pending').length}</div>
                          <div className="text-[12px] text-[#6B7280]">待处理</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[#6B7280] text-[14px] p-8">
                <Compass className="w-10 h-10 mb-3 text-[#E5E7EB]" />
                <p>当前简历暂无校准报告。</p>
                <button onClick={() => router.push('/calibration')} className="mt-4 text-[#235C4E] font-semibold">
                  去校准简历
                </button>
              </div>
            )}
          </div>
        )}

        {/* Version History Drawer Overlay */}
        {showVersions && (
          <div className="absolute inset-y-0 left-0 w-[300px] bg-white border-r border-[#E5E7EB] shadow-2xl z-20 flex flex-col">
            <div className="h-10 bg-[#F7F8F6] border-b border-[#E5E7EB] flex items-center justify-between px-4 shrink-0">
              <span className="text-[12px] font-semibold text-[#1F2933] flex items-center">
                <History className="w-3.5 h-3.5 mr-1.5 text-[#235C4E]" /> 本地版本库
              </span>
              <button onClick={() => setShowVersions(false)} className="text-[#6B7280] hover:text-[#1F2933]">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {versions.map((v, i) => (
                  <div key={v.id} className={`p-3 border rounded-lg text-left w-full ${i === 0 ? 'border-[#235C4E] bg-[#F0FDF4]' : 'border-[#E5E7EB] bg-white hover:bg-[#F7F8F6]'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-[13px] text-[#1F2933] truncate max-w-[180px]">{v.versionName}</span>
                      {i === 0 && <span className="text-[10px] bg-[#235C4E] text-white px-1.5 py-0.5 rounded ml-2">当前</span>}
                    </div>
                    <div className="text-[11px] text-[#6B7280] mb-2">
                      {new Date(v.savedAt).toLocaleString()}
                    </div>
                    {i !== 0 && (
                      <button 
                        onClick={async () => {
                          await rollbackToVersion(v);
                          setContent(v.content);
                          setShowVersions(false);
                        }}
                        className="text-[12px] text-[#235C4E] font-medium hover:underline"
                      >
                        [回滚到此版本]
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {confirmSuggestion && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="h-14 border-b border-[#E5E7EB] flex items-center justify-between px-6 shrink-0 bg-[#F7F8F6]">
                <div className="flex items-center text-[#1F2933] font-semibold">
                  <AlertTriangle className="w-5 h-5 mr-2 text-[#D97706]" />
                  确认应用建议
                </div>
                <button onClick={() => setConfirmSuggestion(null)} className="text-[#6B7280] hover:text-[#1F2933] transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-4">
                <div>
                  <div className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">原文片段</div>
                  <div className="p-3 bg-white border border-[#E5E7EB] rounded-lg text-[13px] text-[#6B7280] whitespace-pre-wrap leading-relaxed">
                    {confirmSuggestion.originalText}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">替换表达</div>
                  <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg text-[13px] text-[#1F2933] whitespace-pre-wrap leading-relaxed">
                    {confirmSuggestion.replacementText}
                  </div>
                </div>
                {confirmSuggestion.missingInfo && (
                  <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-[13px] text-[#92400E] whitespace-pre-wrap leading-relaxed">
                    {confirmSuggestion.missingInfo}
                  </div>
                )}
                {confirmSuggestion.riskWarning && (
                  <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[13px] text-[#DC2626] whitespace-pre-wrap leading-relaxed">
                    {confirmSuggestion.riskWarning}
                  </div>
                )}
                {confirmSuggestion.needsConfirmation && (
                  <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-[13px] text-[#D97706] whitespace-pre-wrap leading-relaxed">
                    {confirmSuggestion.needsConfirmation}
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex justify-end gap-3">
                <button
                  onClick={() => setConfirmSuggestion(null)}
                  className="px-4 py-2 text-sm font-medium text-[#4B5563] hover:text-[#1F2933] transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    const s = confirmSuggestion;
                    if (!s) return;
                    setConfirmSuggestion(null);
                    await handleApplySuggestion(s, true);
                  }}
                  className="flex items-center gap-2 px-5 py-2 bg-[#235C4E] text-white text-sm font-medium rounded-lg hover:bg-[#1a453a] transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  确认应用
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Optimization Trajectory Modal */}
        {showOptimizationModal && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="h-14 border-b border-[#E5E7EB] flex items-center justify-between px-6 shrink-0 bg-[#F7F8F6]">
                <div className="flex items-center text-[#1F2933] font-semibold">
                  <LineChart className="w-5 h-5 mr-2 text-[#235C4E]" />
                  优化轨迹
                </div>
                <button onClick={() => setShowOptimizationModal(false)} className="text-[#6B7280] hover:text-[#1F2933] transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto">
                <div className="mb-8">
                  <h3 className="text-[16px] font-bold mb-4 flex items-center text-[#1F2933]">
                    <Sparkles className="w-4 h-4 mr-2 text-[#D97706]" /> 优化轨迹概览
                  </h3>
                  <div className="grid grid-cols-3 gap-3 bg-[#F7F8F6] p-5 rounded-lg border border-[#E5E7EB]">
                    <div className="text-center">
                      <div className="text-[12px] text-[#6B7280] mb-2">已记录修改</div>
                      <div className="text-3xl font-bold text-[#235C4E]">{optimizationEvents.length}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[12px] text-[#6B7280] mb-2">已应用建议</div>
                      <div className="text-3xl font-bold text-[#235C4E]">
                        {report?.suggestions.filter((suggestion) => suggestion.status === 'applied').length ?? 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[12px] text-[#6B7280] mb-2">待处理建议</div>
                      <div className="text-3xl font-bold text-[#D97706]">
                        {report?.suggestions.filter((suggestion) => suggestion.status === 'pending').length ?? 0}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[16px] font-bold mb-4 flex items-center text-[#1F2933]">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-[#235C4E]" /> 核心改进点
                  </h3>
                  {optimizationEvents.length === 0 ? (
                    <div className="p-6 border border-[#E5E7EB] rounded-lg bg-white text-[13px] text-[#6B7280]">
                      暂无已应用的优化记录。应用右侧建议后，这里会记录修改前后、原因和预计提升。
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {optimizationEvents.map((event) => (
                        <div key={event.id} className="p-4 border border-[#E5E7EB] rounded-lg bg-white">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <span className="px-2 py-1 bg-[#F0FDF4] text-[#235C4E] text-[11px] font-medium rounded border border-[#BBF7D0]">
                              {event.estimatedLift}
                            </span>
                            <span className="text-[11px] text-[#6B7280] shrink-0">{new Date(event.createdAt).toLocaleString('zh-CN')}</span>
                          </div>
                          <p className="text-[12px] text-[#6B7280] mb-3">{event.reason}</p>
                          <div className="grid sm:grid-cols-2 gap-4 text-[12px]">
                            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-[#DC2626] line-through opacity-80">
                              {event.beforeText}
                            </div>
                            <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded text-[#1F2933]">
                              {event.afterText}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
