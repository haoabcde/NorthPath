import { generateJSON } from '../services/llm';
import type { CalibrationReportDraft } from './report';

export type CalibrationProgress = {
  step: 1 | 2 | 3 | 4 | 5;
  title: string;
  stats?: Record<string, number>;
};

type PipelineInput = {
  jobTitle: string;
  jobStage: string;
  jobDirection: string;
  targetJD: string;
  resumeText: string;
};

const JOB_COORDINATES_SYSTEM = `你是一个专业的岗位解析专家。请根据目标岗位名称/方向/阶段以及 JD（如果有）输出岗位坐标。
必须返回合法 JSON，只返回 JSON。
结构：{ "jobCoordinates": { "hardReqs":[], "keywords":[], "implicitSkills":[], "alternatives":[] } }`;

const READINESS_SYSTEM = `你是一个专业的简历评估专家。请根据岗位坐标、目标 JD 和简历内容，输出投递准备度与五维罗盘分数，并给出一页纸建议。
必须返回合法 JSON，只返回 JSON。
结构：{
  "readiness": { "status":"可以直接投递|可以尝试投递|建议优化后投递|暂不建议投递", "reason":"" },
  "radarScores": { "direction":0, "value":0, "clarity":0, "evidence":0, "efficiency":0 },
  "onePageAdvice": { "summary":"", "strengths":[], "priorityFixes":[], "nextActions":[] }
}`;

const MODULE_CHECK_SYSTEM = `你是一个专业的简历模块体检专家。请输出模块体检表与可执行修正任务路线。
必须返回合法 JSON，只返回 JSON。
结构：{
  "moduleChecks":[{ "targetModule":"", "shortcoming":"", "impact":"", "suggestion":"", "level":"P0|P1|P2" }],
  "tasks":[{ "level":"P0|P1|P2", "description":"", "reason":"", "targetModule":"" }]
}`;

const DETAIL_FIX_SYSTEM = `你是一个专业的简历深度校准专家。请输出：岗位命中图谱、能力证据链、经历含金量排序、空泛表达扫描、关键段落修正建议。
必须返回合法 JSON，只返回 JSON。不要编造公司、奖项、数据或结果；涉及数据/工具/贡献/结果的改写必须提示用户确认。
结构：{
  "requirementHits":[{ "requirement":"", "resumeEvidence":"", "hitLevel":"命中|部分命中|未命中", "action":"" }],
  "evidenceChains":[{ "claim":"", "evidence":"", "strength":"强|中|弱", "gap":"", "suggestion":"" }],
  "experienceRankings":[{ "title":"", "value":"高|中|低", "reason":"", "recommendedOrder":1 }],
  "vagueExpressions":[{ "originalText":"", "problem":"", "replacement":"", "level":"P0|P1|P2" }],
  "suggestions":[{ "originalText":"", "shortcoming":"", "suggestion":"", "replacementText":"", "missingInfo":"", "riskWarning":"", "reason":"", "needsConfirmation":"", "level":"P0|P1|P2", "status":"pending" }]
}`;

export async function runCalibrationPipeline(
  input: PipelineInput,
  onProgress: (p: CalibrationProgress) => void,
): Promise<CalibrationReportDraft> {
  const base = `目标岗位：${input.jobTitle}\n求职阶段：${input.jobStage}\n岗位方向：${input.jobDirection}\n目标 JD：${input.targetJD || '无'}\n\n`;

  onProgress({ step: 1, title: '岗位坐标解析' });
  const jobPart = await generateJSON<Pick<CalibrationReportDraft, 'jobCoordinates'>>(base, JOB_COORDINATES_SYSTEM);
  onProgress({
    step: 1,
    title: '岗位坐标解析',
    stats: {
      hardReqs: Array.isArray(jobPart.jobCoordinates?.hardReqs) ? jobPart.jobCoordinates!.hardReqs.length : 0,
      keywords: Array.isArray(jobPart.jobCoordinates?.keywords) ? jobPart.jobCoordinates!.keywords.length : 0,
    },
  });

  onProgress({ step: 2, title: '简历航向判断' });
  const readinessPart = await generateJSON<Pick<CalibrationReportDraft, 'readiness' | 'radarScores' | 'onePageAdvice'>>(
    `${base}岗位坐标：\n${JSON.stringify(jobPart.jobCoordinates ?? {}, null, 2)}\n\n简历内容：\n${input.resumeText}\n`,
    READINESS_SYSTEM,
  );
  onProgress({
    step: 2,
    title: '简历航向判断',
    stats: {
      priorityFixes: Array.isArray(readinessPart.onePageAdvice?.priorityFixes) ? readinessPart.onePageAdvice!.priorityFixes.length : 0,
    },
  });

  onProgress({ step: 3, title: '内容模块体检' });
  const modulePart = await generateJSON<Pick<CalibrationReportDraft, 'moduleChecks' | 'tasks'>>(
    `${base}简历内容：\n${input.resumeText}\n`,
    MODULE_CHECK_SYSTEM,
  );
  onProgress({
    step: 3,
    title: '内容模块体检',
    stats: {
      moduleChecks: Array.isArray(modulePart.moduleChecks) ? modulePart.moduleChecks.length : 0,
      tasks: Array.isArray(modulePart.tasks) ? modulePart.tasks.length : 0,
    },
  });

  onProgress({ step: 4, title: '关键段落修正' });
  const detailPart = await generateJSON<
    Pick<
      CalibrationReportDraft,
      'requirementHits' | 'evidenceChains' | 'experienceRankings' | 'vagueExpressions' | 'suggestions'
    >
  >(
    `${base}岗位坐标：\n${JSON.stringify(jobPart.jobCoordinates ?? {}, null, 2)}\n\n简历内容：\n${input.resumeText}\n`,
    DETAIL_FIX_SYSTEM,
  );
  onProgress({
    step: 4,
    title: '关键段落修正',
    stats: {
      requirementHits: Array.isArray(detailPart.requirementHits) ? detailPart.requirementHits.length : 0,
      suggestions: Array.isArray(detailPart.suggestions) ? detailPart.suggestions.length : 0,
      vagueExpressions: Array.isArray(detailPart.vagueExpressions) ? detailPart.vagueExpressions.length : 0,
    },
  });

  onProgress({ step: 5, title: '优化轨迹回放', stats: { suggestions: Array.isArray(detailPart.suggestions) ? detailPart.suggestions.length : 0 } });

  return {
    ...jobPart,
    ...readinessPart,
    ...modulePart,
    ...detailPart,
  };
}

