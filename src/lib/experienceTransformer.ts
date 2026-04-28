export type ExperienceTransformerRecommendedWrite = '可写' | '谨慎可写' | '不建议写';

export type ExperienceTransformerResult = {
  recommendedModule: string;
  abilities: string[];
  recommendedWrite: ExperienceTransformerRecommendedWrite;
  missingQuestions: string[];
  doNotExaggerate: string[];
  variants: Record<string, string>;
  riskWarning: string;
};

const stringList = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

export const normalizeExperienceTransformerResult = (
  raw: Partial<ExperienceTransformerResult> | null | undefined
): ExperienceTransformerResult => ({
  recommendedModule: typeof raw?.recommendedModule === 'string' ? raw.recommendedModule : '',
  abilities: stringList(raw?.abilities),
  recommendedWrite:
    raw?.recommendedWrite === '可写' || raw?.recommendedWrite === '谨慎可写' || raw?.recommendedWrite === '不建议写'
      ? raw.recommendedWrite
      : '谨慎可写',
  missingQuestions: stringList(raw?.missingQuestions),
  doNotExaggerate: stringList(raw?.doNotExaggerate),
  variants: typeof raw?.variants === 'object' && raw?.variants ? (raw.variants as Record<string, string>) : {},
  riskWarning: typeof raw?.riskWarning === 'string' ? raw.riskWarning : '',
});

