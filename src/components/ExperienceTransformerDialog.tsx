'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Lightbulb, Loader2, X } from 'lucide-react';
import { generateJSON } from '../services/llm';
import { normalizeExperienceTransformerResult, type ExperienceTransformerResult } from '../lib/experienceTransformer';
import { EXPERIENCE_TRANSFORMER_SYSTEM_PROMPT } from '../lib/experienceTransformerPrompt';

export default function ExperienceTransformerDialog({
  open,
  onClose,
  context,
  onAddToPool,
}: {
  open: boolean;
  onClose: () => void;
  context: { jobTitle: string; jobStage: string; jobDirection: string; targetJD: string };
  onAddToPool: (payload: { chosenText: string; raw: string; qa: Record<string, string>; meta: ExperienceTransformerResult }) => void;
}) {
  const [raw, setRaw] = useState('');
  const [qa, setQa] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExperienceTransformerResult | null>(null);
  const [variantKey, setVariantKey] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setRaw('');
    setQa({});
    setResult(null);
    setVariantKey('');
    setIsGenerating(false);
    setError('');
  }, [open]);

  const prompt = useMemo(() => {
    const qaText = Object.keys(qa).length > 0 ? `追问补充：\n${JSON.stringify(qa, null, 2)}\n\n` : '';
    return `目标岗位：${context.jobTitle}（${context.jobStage}）
岗位方向：${context.jobDirection}
目标 JD：${context.targetJD || '无'}

原始经历描述：
${raw}

${qaText}请按要求返回 JSON。`;
  }, [context.jobDirection, context.jobStage, context.jobTitle, context.targetJD, qa, raw]);

  const run = async () => {
    if (!raw.trim()) return;
    setIsGenerating(true);
    setError('');
    try {
      const next = await generateJSON<ExperienceTransformerResult>(prompt, EXPERIENCE_TRANSFORMER_SYSTEM_PROMPT);
      const normalized = normalizeExperienceTransformerResult(next);
      setResult(normalized);
      const keys = Object.keys(normalized.variants ?? {});
      setVariantKey((prev) => (prev && keys.includes(prev) ? prev : (keys.includes('岗位化版本') ? '岗位化版本' : keys[0] || '')));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const chosenText = useMemo(() => {
    if (!result || !variantKey) return '';
    return (result.variants?.[variantKey] ?? '').trim();
  }, [result, variantKey]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="aurora-page fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-2xl max-h-[90vh] bg-white rounded-lg shadow-xl overflow-hidden flex flex-col border border-[#45F6D0]/20"
        >
          <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2 text-[#1F2933]">
              <Lightbulb className="w-5 h-5 text-[#D97706]" />
              <h2 className="text-lg font-semibold">难写经历转化器</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-[#6B7280] hover:text-[#1F2933] hover:bg-[#F3F4F6] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-5">
            <div>
              <div className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">输入普通描述</div>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={4}
                placeholder="例如：我在学生会做过活动，负责宣传；我做了一个小项目但没什么数据..."
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg bg-[#F7F8F6] text-[13px] text-[#1F2933] focus:outline-none focus:ring-2 focus:ring-[#235C4E]/20 focus:border-[#235C4E] transition-all resize-none"
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={run}
                  disabled={isGenerating || !raw.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-[#235C4E] text-white text-[13px] font-medium rounded-lg hover:bg-[#1a453a] transition-colors disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  生成表达
                </button>
              </div>
              {error && <div className="mt-3 text-[13px] text-red-600">{error}</div>}
            </div>

            {result && (
              <div className="space-y-5">
                {result.riskWarning && (
                  <div className="p-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB]">
                    <div className="text-[13px] font-semibold text-[#D97706] mb-2">风险提示</div>
                    <div className="text-[13px] text-[#92400E] whitespace-pre-wrap leading-relaxed">{result.riskWarning}</div>
                  </div>
                )}

                {result.missingQuestions.length > 0 && (
                  <div className="p-4 rounded-xl border border-[#E5E7EB] bg-white">
                    <div className="text-[13px] font-semibold text-[#1F2933] mb-2">需要补充的问题</div>
                    <div className="space-y-2">
                      {result.missingQuestions.map((q) => (
                        <input
                          key={q}
                          value={qa[q] ?? ''}
                          onChange={(e) => setQa((prev) => ({ ...prev, [q]: e.target.value }))}
                          placeholder={q}
                          className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#235C4E]/20 focus:border-[#235C4E]"
                        />
                      ))}
                    </div>
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={run}
                        disabled={isGenerating}
                        className="px-4 py-2 bg-[#235C4E] text-white text-[13px] font-medium rounded-lg hover:bg-[#1a453a] transition-colors disabled:opacity-50"
                      >
                        追问补全后再生成
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-xl border border-[#E5E7EB] bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div className="text-[13px] font-semibold text-[#1F2933]">多版本表达</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(result.variants ?? {}).map((k) => (
                        <button
                          key={k}
                          onClick={() => setVariantKey(k)}
                          className={`px-2.5 py-1 text-[12px] font-medium rounded-md border transition-colors ${
                            variantKey === k
                              ? 'bg-[#235C4E]/5 border-[#235C4E] text-[#235C4E]'
                              : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F8F6] hover:text-[#1F2933]'
                          }`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 bg-[#F7F8F6] border border-[#E5E7EB] rounded-lg text-[13px] text-[#1F2933] whitespace-pre-wrap leading-relaxed min-h-[72px]">
                    {chosenText || '请选择一个版本'}
                  </div>
                  <div className="flex justify-end mt-3">
                    <button
                      disabled={!chosenText}
                      onClick={() => {
                        if (!result || !chosenText) return;
                        onAddToPool({ chosenText, raw, qa, meta: result });
                        onClose();
                      }}
                      className="px-4 py-2 bg-[#235C4E] text-white text-[13px] font-medium rounded-lg hover:bg-[#1a453a] transition-colors disabled:opacity-50"
                    >
                      加入经历池
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

