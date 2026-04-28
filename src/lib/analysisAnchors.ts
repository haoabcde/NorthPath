import type { CalibrationReport, PriorityLevel, SuggestionStatus } from '../services/db';

export type AnalysisAnchorType = 'suggestion' | 'vague' | 'requirement' | 'evidence' | 'module' | 'task';

export type AnalysisAnchor = {
  type: AnalysisAnchorType;
  id: string;
  level?: PriorityLevel;
  status?: SuggestionStatus;
  title: string;
  originalText?: string;
  lineNumber?: number;
};

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

export const findLineNumber = (content: string, target?: string): number | undefined => {
  if (!target?.trim()) return undefined;
  const normalizedTarget = normalize(target);
  if (!normalizedTarget) return undefined;
  const lines = content.split('\n');
  const index = lines.findIndex((line) => {
    const normalizedLine = normalize(line);
    if (!normalizedLine) return false;
    return normalizedLine.includes(normalizedTarget) || normalizedTarget.includes(normalizedLine);
  });
  return index >= 0 ? index + 1 : undefined;
};

export const buildAnalysisAnchors = (content: string, report: CalibrationReport | null): AnalysisAnchor[] => {
  if (!report) return [];

  const anchors: AnalysisAnchor[] = [];

  report.suggestions.forEach((suggestion) => {
    anchors.push({
      type: 'suggestion',
      id: suggestion.id,
      level: suggestion.level,
      status: suggestion.status,
      title: suggestion.shortcoming,
      originalText: suggestion.originalText,
      lineNumber: findLineNumber(content, suggestion.originalText),
    });
  });

  report.vagueExpressions.forEach((item, index) => {
    anchors.push({
      type: 'vague',
      id: `vague-${index}`,
      level: item.level,
      title: item.problem,
      originalText: item.originalText,
      lineNumber: findLineNumber(content, item.originalText),
    });
  });

  report.requirementHits.forEach((item, index) => {
    anchors.push({
      type: 'requirement',
      id: `requirement-${index}`,
      title: item.requirement,
      originalText: item.resumeEvidence,
      lineNumber: findLineNumber(content, item.resumeEvidence),
    });
  });

  report.evidenceChains.forEach((item, index) => {
    anchors.push({
      type: 'evidence',
      id: `evidence-${index}`,
      title: item.claim,
      originalText: item.evidence,
      lineNumber: findLineNumber(content, item.evidence),
    });
  });

  report.moduleChecks.forEach((item, index) => {
    anchors.push({
      type: 'module',
      id: `module-${index}`,
      level: item.level,
      title: item.targetModule,
      originalText: item.targetModule,
      lineNumber: findLineNumber(content, item.targetModule),
    });
  });

  report.tasks.forEach((item, index) => {
    anchors.push({
      type: 'task',
      id: `task-${index}`,
      level: item.level,
      title: item.description,
      originalText: item.targetModule,
      lineNumber: findLineNumber(content, item.targetModule),
    });
  });

  return anchors;
};
