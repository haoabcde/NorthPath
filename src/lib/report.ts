import type { CalibrationReport, PriorityLevel, SuggestionStatus } from '../services/db';

export type CalibrationReportDraft = {
  jobCoordinates?: Partial<CalibrationReport['jobCoordinates']>;
  readiness?: Partial<CalibrationReport['readiness']>;
  radarScores?: Partial<CalibrationReport['radarScores']>;
  requirementHits?: Array<Partial<CalibrationReport['requirementHits'][number]>>;
  evidenceChains?: Array<Partial<CalibrationReport['evidenceChains'][number]>>;
  experienceRankings?: Array<Partial<CalibrationReport['experienceRankings'][number]>>;
  vagueExpressions?: Array<Partial<CalibrationReport['vagueExpressions'][number]>>;
  onePageAdvice?: Partial<CalibrationReport['onePageAdvice']>;
  moduleChecks?: Array<Partial<CalibrationReport['moduleChecks'][number]>>;
  tasks?: Array<Partial<CalibrationReport['tasks'][number]>>;
  suggestions?: Array<Partial<Omit<CalibrationReport['suggestions'][number], 'id'>>>;
};

const clampScore = (score: unknown) => Math.min(20, Math.max(0, Number(score ?? 0) || 0));

const normalizeLevel = (level: unknown): PriorityLevel => {
  if (level === 'P0' || level === 'P1' || level === 'P2') return level;
  return 'P2';
};

const normalizeSuggestionStatus = (status: unknown): SuggestionStatus => {
  if (status === 'pending' || status === 'snoozed' || status === 'applied' || status === 'ignored' || status === 'done') {
    return status;
  }
  return 'pending';
};

const normalizeStatus = (status: unknown): CalibrationReport['readiness']['status'] => {
  if (status === '可以直接投递' || status === '可以尝试投递' || status === '建议优化后投递' || status === '暂不建议投递') {
    return status;
  }
  return '建议优化后投递';
};

const normalizeHitLevel = (value: unknown): CalibrationReport['requirementHits'][number]['hitLevel'] => {
  if (value === '命中' || value === '部分命中' || value === '未命中') return value;
  return '部分命中';
};

const normalizeStrength = (value: unknown): CalibrationReport['evidenceChains'][number]['strength'] => {
  if (value === '强' || value === '中' || value === '弱') return value;
  return '中';
};

const normalizeValue = (value: unknown): CalibrationReport['experienceRankings'][number]['value'] => {
  if (value === '高' || value === '中' || value === '低') return value;
  return '中';
};

const withText = (value: unknown, fallback: string) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : fallback;
};

const stringList = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

export function buildCalibrationReport(
  draft: CalibrationReportDraft,
  resumeId: string,
): CalibrationReport {
  const jobCoordinates = draft.jobCoordinates ?? {};
  const radarScores = draft.radarScores ?? {};
  const moduleChecks = Array.isArray(draft.moduleChecks) ? draft.moduleChecks : [];
  const tasks = Array.isArray(draft.tasks) ? draft.tasks : [];
  const suggestions = Array.isArray(draft.suggestions) ? draft.suggestions : [];
  const requirementHits = Array.isArray(draft.requirementHits) ? draft.requirementHits : [];
  const evidenceChains = Array.isArray(draft.evidenceChains) ? draft.evidenceChains : [];
  const experienceRankings = Array.isArray(draft.experienceRankings) ? draft.experienceRankings : [];
  const vagueExpressions = Array.isArray(draft.vagueExpressions) ? draft.vagueExpressions : [];

  return {
    id: crypto.randomUUID(),
    resumeId,
    jobCoordinates: {
      hardReqs: stringList(jobCoordinates.hardReqs),
      keywords: stringList(jobCoordinates.keywords),
      implicitSkills: stringList(jobCoordinates.implicitSkills),
      alternatives: stringList(jobCoordinates.alternatives),
    },
    readiness: {
      status: normalizeStatus(draft.readiness?.status),
      reason: withText(draft.readiness?.reason, '模型没有返回明确原因，请重新校准或补充目标岗位信息。'),
    },
    radarScores: {
      direction: clampScore(radarScores.direction),
      value: clampScore(radarScores.value),
      clarity: clampScore(radarScores.clarity),
      evidence: clampScore(radarScores.evidence),
      efficiency: clampScore(radarScores.efficiency),
    },
    requirementHits: requirementHits.map((hit) => ({
      requirement: withText(hit.requirement, '未标注岗位要求'),
      resumeEvidence: withText(hit.resumeEvidence, '当前简历没有明确证据'),
      hitLevel: normalizeHitLevel(hit.hitLevel),
      action: withText(hit.action, '补充能证明该要求的经历或关键词'),
    })),
    evidenceChains: evidenceChains.map((chain) => ({
      claim: withText(chain.claim, '未标注能力主张'),
      evidence: withText(chain.evidence, '证据不足'),
      strength: normalizeStrength(chain.strength),
      gap: withText(chain.gap, '缺少动作、工具、过程或结果'),
      suggestion: withText(chain.suggestion, '补充真实细节并降低空泛表述'),
    })),
    experienceRankings: experienceRankings.map((item, index) => ({
      title: withText(item.title, `经历 ${index + 1}`),
      value: normalizeValue(item.value),
      reason: withText(item.reason, '与目标岗位相关，但需要补充更具体证据'),
      recommendedOrder: Number(item.recommendedOrder ?? index + 1) || index + 1,
    })),
    vagueExpressions: vagueExpressions.map((item) => ({
      originalText: withText(item.originalText, ''),
      problem: withText(item.problem, '表达过于笼统'),
      replacement: withText(item.replacement, '补充动作、工具和结果后的表达'),
      level: normalizeLevel(item.level),
    })),
    onePageAdvice: {
      summary: withText(draft.onePageAdvice?.summary, '先修正最影响投递判断的内容，再处理表达细节。'),
      strengths: stringList(draft.onePageAdvice?.strengths),
      priorityFixes: stringList(draft.onePageAdvice?.priorityFixes),
      nextActions: stringList(draft.onePageAdvice?.nextActions),
    },
    moduleChecks: moduleChecks.map((check) => ({
      targetModule: withText(check.targetModule, '未标注模块'),
      shortcoming: withText(check.shortcoming, '暂未识别到具体短板'),
      impact: withText(check.impact, '可能影响岗位匹配判断'),
      suggestion: withText(check.suggestion, '补充更具体的动作、工具和结果'),
      level: normalizeLevel(check.level),
    })),
    tasks: tasks.map((task) => ({
      level: normalizeLevel(task.level),
      description: withText(task.description, '补充一条可执行的简历修改任务'),
      reason: withText(task.reason, '当前内容证明力度不足'),
      targetModule: withText(task.targetModule, '未标注模块'),
    })),
    suggestions: suggestions.map((suggestion) => ({
      id: crypto.randomUUID(),
      originalText: withText(suggestion.originalText, ''),
      shortcoming: withText(suggestion.shortcoming, '表达不够具体'),
      suggestion: withText(suggestion.suggestion, '补充动作、工具、结果和岗位关键词'),
      replacementText: withText(suggestion.replacementText, ''),
      reason: withText(suggestion.reason, '提升内容的岗位匹配度和可信度'),
      missingInfo: suggestion.missingInfo?.trim() ?? '',
      riskWarning: suggestion.riskWarning?.trim() ?? '',
      needsConfirmation: withText(suggestion.needsConfirmation, '应用前请确认表达符合真实经历。'),
      status: normalizeSuggestionStatus(suggestion.status),
      level: normalizeLevel(suggestion.level),
    })),
    generatedAt: Date.now(),
  };
}

export const reportStatusClass = (status: string) => {
  if (status.includes('直接') || status.includes('尝试')) return 'bg-[#F0FDF4] text-[#235C4E] border-[#BBF7D0]';
  if (status.includes('优化')) return 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]';
  return 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]';
};
