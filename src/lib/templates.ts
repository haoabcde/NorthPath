export type ResumeTemplateId = 'classic' | 'compact' | 'modern';

export const RESUME_TEMPLATES: Array<{ id: ResumeTemplateId; name: string }> = [
  { id: 'classic', name: '经典' },
  { id: 'compact', name: '紧凑' },
  { id: 'modern', name: '现代' },
];

export const getTemplateClassName = (id: ResumeTemplateId) => {
  if (id === 'compact') return 'template-compact';
  if (id === 'modern') return 'template-modern';
  return 'template-classic';
};

