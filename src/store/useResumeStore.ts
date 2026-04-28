import { create } from 'zustand';
import {
  Resume,
  ResumeVersion,
  CalibrationReport,
  OptimizationEvent,
  ResumeSource,
  VersionSource,
  JobWritingMap,
  getResumes,
  saveResume,
  getResume,
  deleteResume as deleteDbResume,
  saveVersion,
  getVersions,
  getAllVersions,
  deleteVersion as deleteDbVersion,
  getReport,
  saveReport,
  saveOptimizationEvent,
  getOptimizationEvents,
  clearAllData as clearDbData,
} from '../services/db';

type CreateResumeOptions = {
  targetStage?: string;
  targetDirection?: string;
  source?: ResumeSource;
  parentResumeId?: string;
  variantLabel?: string;
  jobWritingMap?: JobWritingMap;
  templateId?: string;
};

type CreateVersionOptions = {
  source?: VersionSource;
  notes?: string;
  content?: string;
};

interface ResumeState {
  currentResume: Resume | null;
  resumes: Resume[];
  versions: ResumeVersion[];
  allVersions: ResumeVersion[];
  report: CalibrationReport | null;
  optimizationEvents: OptimizationEvent[];
  isLoading: boolean;
  loadResumes: () => Promise<void>;
  loadResume: (id: string) => Promise<void>;
  loadAllVersions: () => Promise<void>;
  createResume: (title: string, targetJob: string, initialContent?: string, options?: CreateResumeOptions) => Promise<string>;
  duplicateResume: (resumeId: string, variantLabel?: string) => Promise<string | null>;
  updateResumeContent: (content: string) => Promise<void>;
  updateResumeTemplate: (templateId: string) => Promise<void>;
  createVersion: (versionName: string, options?: CreateVersionOptions) => Promise<ResumeVersion | null>;
  rollbackToVersion: (version: ResumeVersion) => Promise<void>;
  deleteVersion: (versionId: string) => Promise<void>;
  deleteResume: (resumeId: string) => Promise<void>;
  loadReport: (resumeId: string) => Promise<void>;
  setReport: (report: CalibrationReport) => Promise<void>;
  updateSuggestionStatus: (suggestionId: string, status: CalibrationReport['suggestions'][number]['status']) => Promise<void>;
  applySuggestion: (suggestion: CalibrationReport['suggestions'][number]) => Promise<void>;
  loadOptimizationEvents: (resumeId: string) => Promise<void>;
  addOptimizationEvent: (event: Omit<OptimizationEvent, 'id' | 'createdAt'>) => Promise<void>;
  clearAllData: () => Promise<void>;
}

export const useResumeStore = create<ResumeState>((set, get) => ({
  currentResume: null,
  resumes: [],
  versions: [],
  allVersions: [],
  report: null,
  optimizationEvents: [],
  isLoading: false,

  loadResumes: async () => {
    set({ isLoading: true });
    const resumes = await getResumes();
    set({ resumes, isLoading: false });
  },

  loadResume: async (id: string) => {
    set({ isLoading: true });
    const resume = await getResume(id);
    if (resume) {
      const [versions, report, optimizationEvents] = await Promise.all([
        getVersions(id),
        getReport(id),
        getOptimizationEvents(id),
      ]);
      set({ currentResume: resume, versions, report, optimizationEvents, isLoading: false });
    } else {
      set({ currentResume: null, versions: [], report: null, optimizationEvents: [], isLoading: false });
    }
  },

  loadAllVersions: async () => {
    const allVersions = await getAllVersions();
    set({ allVersions });
  },

  createResume: async (title: string, targetJob: string, initialContent = '', options = {}) => {
    const now = Date.now();
    const newResume: Resume = {
      id: crypto.randomUUID(),
      title,
      targetJob,
      targetStage: options.targetStage,
      targetDirection: options.targetDirection,
      source: options.source ?? 'manual',
      parentResumeId: options.parentResumeId,
      variantLabel: options.variantLabel,
      jobWritingMap: options.jobWritingMap,
      templateId: options.templateId,
      currentContent: initialContent,
      createdAt: now,
      updatedAt: now,
    };
    await saveResume(newResume);

    const newVersion: ResumeVersion = {
      id: crypto.randomUUID(),
      resumeId: newResume.id,
      content: initialContent,
      versionName: options.source === 'imported' ? '原始上传版' : '初始版本',
      source: options.source === 'ai-draft' ? 'ai-draft' : options.source === 'imported' ? 'initial' : 'manual',
      notes: options.variantLabel ? `岗位版本：${options.variantLabel}` : undefined,
      savedAt: now,
    };
    await saveVersion(newVersion);

    await get().loadResumes();
    await get().loadAllVersions();
    return newResume.id;
  },

  duplicateResume: async (resumeId: string, variantLabel = '岗位副本') => {
    const sourceResume = await getResume(resumeId);
    if (!sourceResume) return null;

    const newId = await get().createResume(
      `${sourceResume.title} - ${variantLabel}`,
      sourceResume.targetJob,
      sourceResume.currentContent,
      {
        targetStage: sourceResume.targetStage,
        targetDirection: sourceResume.targetDirection,
        source: 'variant',
        parentResumeId: sourceResume.id,
        variantLabel,
      },
    );
    return newId;
  },

  updateResumeContent: async (content: string) => {
    const { currentResume } = get();
    if (!currentResume) return;

    const updatedResume = {
      ...currentResume,
      currentContent: content,
      updatedAt: Date.now(),
    };
    await saveResume(updatedResume);
    set({ currentResume: updatedResume });
    await get().loadResumes();
  },

  updateResumeTemplate: async (templateId: string) => {
    const { currentResume } = get();
    if (!currentResume) return;

    const updatedResume = {
      ...currentResume,
      templateId,
      updatedAt: Date.now(),
    };
    await saveResume(updatedResume);
    set({ currentResume: updatedResume });
    await get().loadResumes();
  },

  createVersion: async (versionName: string, options = {}) => {
    const { currentResume } = get();
    if (!currentResume) return null;

    const newVersion: ResumeVersion = {
      id: crypto.randomUUID(),
      resumeId: currentResume.id,
      content: options.content ?? currentResume.currentContent,
      versionName,
      source: options.source ?? 'manual',
      notes: options.notes,
      savedAt: Date.now(),
    };
    await saveVersion(newVersion);
    const [versions, allVersions] = await Promise.all([getVersions(currentResume.id), getAllVersions()]);
    set({ versions, allVersions });
    return newVersion;
  },

  rollbackToVersion: async (version: ResumeVersion) => {
    const resume = await getResume(version.resumeId);
    if (!resume) return;
    const updatedResume: Resume = {
      ...resume,
      currentContent: version.content,
      updatedAt: Date.now(),
    };
    await saveResume(updatedResume);
    set({ currentResume: updatedResume });
    await get().createVersion(`回滚：${version.versionName}`, {
      source: 'rollback',
      notes: `从 ${new Date(version.savedAt).toLocaleString('zh-CN')} 的版本回滚`,
      content: version.content,
    });
    await get().loadResumes();
  },

  deleteVersion: async (versionId: string) => {
    await deleteDbVersion(versionId);
    const { currentResume } = get();
    if (currentResume) {
      const versions = await getVersions(currentResume.id);
      set({ versions });
    }
    await get().loadAllVersions();
  },

  deleteResume: async (resumeId: string) => {
    await deleteDbResume(resumeId);
    const { currentResume } = get();
    set({
      currentResume: currentResume?.id === resumeId ? null : currentResume,
      versions: currentResume?.id === resumeId ? [] : get().versions,
      report: currentResume?.id === resumeId ? null : get().report,
      optimizationEvents: currentResume?.id === resumeId ? [] : get().optimizationEvents,
    });
    await get().loadResumes();
    await get().loadAllVersions();
  },

  loadReport: async (resumeId: string) => {
    const report = await getReport(resumeId);
    set({ report });
  },

  setReport: async (report: CalibrationReport) => {
    await saveReport(report);
    set({ report });
  },

  updateSuggestionStatus: async (suggestionId, status) => {
    const { report } = get();
    if (!report) return;
    const updatedReport: CalibrationReport = {
      ...report,
      suggestions: report.suggestions.map((suggestion) => {
        return suggestion.id === suggestionId ? { ...suggestion, status } : suggestion;
      }),
    };
    await saveReport(updatedReport);
    set({ report: updatedReport });
  },

  applySuggestion: async (suggestion) => {
    const { currentResume, updateResumeContent, createVersion, addOptimizationEvent, updateSuggestionStatus } = get();
    if (!currentResume) return;

    if (!suggestion.originalText.trim() || !suggestion.replacementText.trim()) return;
    const newContent = currentResume.currentContent.replace(suggestion.originalText, suggestion.replacementText);
    if (newContent === currentResume.currentContent) return;

    await updateResumeContent(newContent);
    const version = await createVersion(`应用建议 - ${new Date().toLocaleTimeString('zh-CN')}`, {
      source: 'suggestion',
      notes: suggestion.shortcoming,
    });
    await addOptimizationEvent({
      resumeId: currentResume.id,
      versionId: version?.id,
      suggestionId: suggestion.id,
      beforeText: suggestion.originalText,
      afterText: suggestion.replacementText,
      reason: suggestion.reason || suggestion.suggestion,
      estimatedLift: '预计提升岗位匹配度、表达清晰度与证据强度',
    });
    await updateSuggestionStatus(suggestion.id, 'applied');
  },

  loadOptimizationEvents: async (resumeId: string) => {
    const optimizationEvents = await getOptimizationEvents(resumeId);
    set({ optimizationEvents });
  },

  addOptimizationEvent: async (event) => {
    const newEvent: OptimizationEvent = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...event,
    };
    await saveOptimizationEvent(newEvent);
    const optimizationEvents = await getOptimizationEvents(event.resumeId);
    set({ optimizationEvents });
  },

  clearAllData: async () => {
    await clearDbData();
    set({ resumes: [], allVersions: [], currentResume: null, versions: [], report: null, optimizationEvents: [] });
  },
}));
