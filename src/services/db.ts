import localforage from 'localforage';
import type { JobWritingMap } from '../lib/jobWritingMap';

export type { JobWritingMap } from '../lib/jobWritingMap';

export type ResumeSource = 'manual' | 'imported' | 'ai-draft' | 'calibrated' | 'variant';
export type VersionSource = 'initial' | 'manual' | 'ai-draft' | 'calibration' | 'suggestion' | 'rollback' | 'variant';
export type PriorityLevel = 'P0' | 'P1' | 'P2';
export type SuggestionStatus = 'pending' | 'snoozed' | 'applied' | 'ignored' | 'done';

export interface Resume {
  id: string;
  title: string;
  targetJob: string;
  targetStage?: string;
  targetDirection?: string;
  source?: ResumeSource;
  parentResumeId?: string;
  variantLabel?: string;
  jobWritingMap?: JobWritingMap;
  templateId?: string;
  currentContent: string;
  createdAt: number;
  updatedAt: number;
}

export interface ResumeVersion {
  id: string;
  resumeId: string;
  content: string;
  versionName: string;
  source?: VersionSource;
  notes?: string;
  savedAt: number;
}

export interface CalibrationReport {
  id: string;
  resumeId: string;
  jobCoordinates: {
    hardReqs: string[];
    keywords: string[];
    implicitSkills: string[];
    alternatives: string[];
  };
  readiness: {
    status: '可以直接投递' | '可以尝试投递' | '建议优化后投递' | '暂不建议投递';
    reason: string;
  };
  radarScores: {
    direction: number;
    value: number;
    clarity: number;
    evidence: number;
    efficiency: number;
  };
  requirementHits: Array<{
    requirement: string;
    resumeEvidence: string;
    hitLevel: '命中' | '部分命中' | '未命中';
    action: string;
  }>;
  evidenceChains: Array<{
    claim: string;
    evidence: string;
    strength: '强' | '中' | '弱';
    gap: string;
    suggestion: string;
  }>;
  experienceRankings: Array<{
    title: string;
    value: '高' | '中' | '低';
    reason: string;
    recommendedOrder: number;
  }>;
  vagueExpressions: Array<{
    originalText: string;
    problem: string;
    replacement: string;
    level: PriorityLevel;
  }>;
  onePageAdvice: {
    summary: string;
    strengths: string[];
    priorityFixes: string[];
    nextActions: string[];
  };
  moduleChecks: Array<{
    targetModule: string;
    shortcoming: string;
    impact: string;
    suggestion: string;
    level: PriorityLevel;
  }>;
  tasks: Array<{
    level: PriorityLevel;
    description: string;
    reason: string;
    targetModule: string;
  }>;
  suggestions: Array<{
    id: string;
    originalText: string;
    shortcoming: string;
    suggestion: string;
    replacementText: string;
    reason: string;
    missingInfo: string;
    riskWarning: string;
    needsConfirmation: string;
    status: SuggestionStatus;
    level?: PriorityLevel;
  }>;
  generatedAt: number;
}

export interface OptimizationEvent {
  id: string;
  resumeId: string;
  versionId?: string;
  suggestionId?: string;
  beforeText: string;
  afterText: string;
  reason: string;
  estimatedLift: string;
  createdAt: number;
}

const DB_NAME = 'NorthPathV3';

localforage.config({
  name: DB_NAME,
  storeName: 'northpath_data',
});

export const db = {
  resumes: localforage.createInstance({ name: DB_NAME, storeName: 'resumes' }),
  versions: localforage.createInstance({ name: DB_NAME, storeName: 'versions' }),
  reports: localforage.createInstance({ name: DB_NAME, storeName: 'reports' }),
  optimizationEvents: localforage.createInstance({ name: DB_NAME, storeName: 'optimization_events' }),
};

export const getResumes = async (): Promise<Resume[]> => {
  const resumes: Resume[] = [];
  await db.resumes.iterate((value: Resume) => {
    resumes.push(value);
  });
  return resumes.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const saveResume = async (resume: Resume): Promise<void> => {
  await db.resumes.setItem(resume.id, resume);
};

export const getResume = async (id: string): Promise<Resume | null> => {
  return await db.resumes.getItem(id);
};

export const deleteResume = async (id: string): Promise<void> => {
  await db.resumes.removeItem(id);
  const versions = await getVersions(id);
  await Promise.all(versions.map((version) => db.versions.removeItem(version.id)));
  const reports: CalibrationReport[] = [];
  await db.reports.iterate((value: CalibrationReport) => {
    if (value.resumeId === id) reports.push(value);
  });
  await Promise.all(reports.map((report) => db.reports.removeItem(report.id)));
  const events = await getOptimizationEvents(id);
  await Promise.all(events.map((event) => db.optimizationEvents.removeItem(event.id)));
};

export const saveVersion = async (version: ResumeVersion): Promise<void> => {
  await db.versions.setItem(version.id, version);
};

export const getVersions = async (resumeId: string): Promise<ResumeVersion[]> => {
  const versions: ResumeVersion[] = [];
  await db.versions.iterate((value: ResumeVersion) => {
    if (value.resumeId === resumeId) {
      versions.push(value);
    }
  });
  return versions.sort((a, b) => b.savedAt - a.savedAt);
};

export const getAllVersions = async (): Promise<ResumeVersion[]> => {
  const versions: ResumeVersion[] = [];
  await db.versions.iterate((value: ResumeVersion) => {
    versions.push(value);
  });
  return versions.sort((a, b) => b.savedAt - a.savedAt);
};

export const deleteVersion = async (id: string): Promise<void> => {
  await db.versions.removeItem(id);
};

export const saveReport = async (report: CalibrationReport): Promise<void> => {
  await db.reports.setItem(report.id, report);
};

export const getReport = async (resumeId: string): Promise<CalibrationReport | null> => {
  const reports: CalibrationReport[] = [];
  await db.reports.iterate((value: CalibrationReport) => {
    if (value.resumeId === resumeId) {
      reports.push(value);
    }
  });
  if (reports.length === 0) return null;
  return reports.sort((a, b) => b.generatedAt - a.generatedAt)[0];
};

export const saveOptimizationEvent = async (event: OptimizationEvent): Promise<void> => {
  await db.optimizationEvents.setItem(event.id, event);
};

export const getOptimizationEvents = async (resumeId: string): Promise<OptimizationEvent[]> => {
  const events: OptimizationEvent[] = [];
  await db.optimizationEvents.iterate((value: OptimizationEvent) => {
    if (value.resumeId === resumeId) events.push(value);
  });
  return events.sort((a, b) => b.createdAt - a.createdAt);
};

export const clearAllData = async (): Promise<void> => {
  await db.resumes.clear();
  await db.versions.clear();
  await db.reports.clear();
  await db.optimizationEvents.clear();
};
