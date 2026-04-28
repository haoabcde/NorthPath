export type JobWritingMap = {
  coreAbilities: string[];
  mustHave: string[];
  canDeprioritize: string[];
  studentProofs: string[];
  recommendedStructure: string[];
};

const stringList = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

export const normalizeJobWritingMap = (raw: Partial<JobWritingMap> | null | undefined): JobWritingMap => ({
  coreAbilities: stringList(raw?.coreAbilities),
  mustHave: stringList(raw?.mustHave),
  canDeprioritize: stringList(raw?.canDeprioritize),
  studentProofs: stringList(raw?.studentProofs),
  recommendedStructure: stringList(raw?.recommendedStructure),
});

