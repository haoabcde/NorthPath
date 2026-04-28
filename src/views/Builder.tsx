'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, Sparkles, Compass, CheckCircle2, Plus, Trash2, Briefcase, GraduationCap, Award, PenTool, LayoutTemplate, Zap, Shield, BookOpen, Activity, Lightbulb } from 'lucide-react';
import { useResumeStore } from '../store/useResumeStore';
import { generateJSON, callLLM } from '../services/llm';
import JobWritingMapPanel from '../components/JobWritingMapPanel';
import ExperienceTransformerDialog from '../components/ExperienceTransformerDialog';
import { normalizeJobWritingMap, type JobWritingMap } from '../lib/jobWritingMap';
import { JOB_WRITING_MAP_SYSTEM_PROMPT } from '../lib/jobWritingMapPrompt';

// Types
type JobStage = '实习' | '校招' | '转专业' | '零经验' | '';
type JobDirection = '技术' | '产品' | '运营' | '市场' | '数据' | '设计' | '通用' | '其他' | '';

interface ExperienceItem {
  id: string;
  type: string;
  answers: Record<string, string>;
}

interface AnalyzedExperience extends ExperienceItem {
  ability: string;
  module: string;
  value: '高' | '中' | '低';
  status: '可直接写入' | '需要补充后写入' | '可弱化写入' | '不建议写入';
  details: {
    reason: string;
    suggestion: string;
    optimizedText: string;
  };
}

const EXP_TYPES = [
  { id: '课程项目', icon: <BookOpen className="w-5 h-5" /> },
  { id: '校园活动', icon: <Activity className="w-5 h-5" /> },
  { id: '竞赛经历', icon: <Award className="w-5 h-5" /> },
  { id: '个人作品', icon: <PenTool className="w-5 h-5" /> },
  { id: '实习/兼职', icon: <Briefcase className="w-5 h-5" /> },
  { id: '研究/调研', icon: <Compass className="w-5 h-5" /> },
  { id: '技能学习', icon: <GraduationCap className="w-5 h-5" /> },
];

const EXP_QUESTIONS: Record<string, string[]> = {
  '课程项目': [
    '项目主题是什么？', '是几个人完成的？', '你负责哪一部分？', 
    '用了哪些工具、技术或方法？', '最难的地方是什么？你怎么解决的？', 
    '最后产出了什么？', '有没有评分、用户、数据、展示、上线？'
  ],
  '校园活动': [
    '活动目标是什么？', '你负责策划、宣传、执行、社群还是数据？', 
    '面向多少人？', '你做了哪些具体动作？', 
    '活动结果如何？', '有没有报名人数、到场人数、推文阅读量？'
  ],
  '竞赛经历': [
    '竞赛名称和级别？', '你的核心贡献是什么？', 
    '遇到了什么挑战？', '最终获得了什么奖项或名次？'
  ],
  '个人作品': [
    '作品类型和主题是什么？', '你独立完成了哪些核心工作？', '作品带来了什么影响或反馈？'
  ],
  '实习/兼职': [
    '公司名称和岗位是什么？', '你的日常工作内容有哪些？', 
    '你主导或参与了什么重要项目？', '有哪些可量化的工作成果？'
  ],
  '研究/调研': [
    '研究课题或调研目标是什么？', '你采用了什么研究方法或工具？', 
    '你在团队中承担了什么角色？', '最终产出了什么报告或结论？'
  ],
  '技能学习': [
    '学习了什么技能或工具？', '通过什么途径学习的？', '能够独立用它完成什么实际任务？'
  ]
};

const STATUS_OPTIONS = ['没有简历', '简历很空', '想换方向', '想投多个岗位'];
const VERSION_OPTIONS = ['保守版', '强化版', '技术版', '产品版', '运营版', '数据版'];

export default function Builder() {
  const router = useRouter();
  const { createResume } = useResumeStore();
  
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  // Step 1 State
  const [jobStage, setJobStage] = useState<JobStage>('');
  const [jobDirection, setJobDirection] = useState<JobDirection>('');
  const [jobDirectionCustom, setJobDirectionCustom] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [targetJD, setTargetJD] = useState('');
  const [currentStatus, setCurrentStatus] = useState<string[]>([]);
  const [jobWritingMap, setJobWritingMap] = useState<JobWritingMap | null>(null);
  const [jobWritingMapError, setJobWritingMapError] = useState('');
  const [isGeneratingJobWritingMap, setIsGeneratingJobWritingMap] = useState(false);
  const lastJobMapKeyRef = useRef('');

  // Step 2 State
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [activeExpType, setActiveExpType] = useState<string>('');
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string>>({});

  // Step 3 State
  const [experiencePool, setExperiencePool] = useState<AnalyzedExperience[]>([]);
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);
  const [activeExpId, setActiveExpId] = useState<string | null>(null);
  const [isTransformerOpen, setIsTransformerOpen] = useState(false);

  // Step 4 State
  const [resumeVersion, setResumeVersion] = useState('强化版');

  const steps = [
    { id: 1, title: '目标岗位', desc: '明确你想投递的方向' },
    { id: 2, title: '经历挖掘', desc: '提取真实项目素材' },
    { id: 3, title: '可写经历池', desc: '转化与选择经历素材' },
    { id: 4, title: '岗位化生成', desc: '自动生成 Markdown 初稿' }
  ];

  const handleStatusToggle = (status: string) => {
    setCurrentStatus(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  useEffect(() => {
    if (step !== 1) return;
    const resolvedDirection = jobDirection === '其他' ? jobDirectionCustom : jobDirection;
    if (!jobTitle.trim() || !jobStage || !resolvedDirection?.trim()) return;

    const key = JSON.stringify({
      jobStage,
      jobTitle: jobTitle.trim(),
      jobDirection: resolvedDirection.trim(),
      targetJD: targetJD.trim(),
    });
    if (key === lastJobMapKeyRef.current) return;

    const timer = window.setTimeout(async () => {
      try {
        setIsGeneratingJobWritingMap(true);
        setJobWritingMapError('');
        const prompt = `目标岗位：${jobTitle.trim()}（${jobStage}）
岗位方向：${resolvedDirection.trim()}
目标 JD：${targetJD.trim() || '无'}

请输出岗位写作地图 JSON。`;
        const map = await generateJSON<JobWritingMap>(prompt, JOB_WRITING_MAP_SYSTEM_PROMPT);
        lastJobMapKeyRef.current = key;
        setJobWritingMap(normalizeJobWritingMap(map));
      } catch (error) {
        setJobWritingMap(null);
        setJobWritingMapError(error instanceof Error ? error.message : '岗位写作地图生成失败');
      } finally {
        setIsGeneratingJobWritingMap(false);
      }
    }, 600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [jobDirection, jobDirectionCustom, jobStage, jobTitle, step, targetJD]);

  const handleAddExperience = () => {
    if (!activeExpType) return;
    const newExp: ExperienceItem = {
      id: Date.now().toString(),
      type: activeExpType,
      answers: currentAnswers
    };
    setExperiences([...experiences, newExp]);
    setActiveExpType('');
    setCurrentAnswers({});
  };

  const handleDeleteExperience = (id: string) => {
    setExperiences(experiences.filter(exp => exp.id !== id));
  };

  const resolvedJobDirection = jobDirection === '其他' ? jobDirectionCustom : jobDirection;

  const handleAddTransformedExperience = (payload: {
    chosenText: string;
    raw: string;
    qa: Record<string, string>;
    meta: {
      recommendedModule: string;
      abilities: string[];
      recommendedWrite: '可写' | '谨慎可写' | '不建议写';
      missingQuestions: string[];
      doNotExaggerate: string[];
      variants: Record<string, string>;
      riskWarning: string;
    };
  }) => {
    const id = crypto.randomUUID();
    const ability = payload.meta.abilities.slice(0, 3).join('、') || '综合能力';
    const status =
      payload.meta.recommendedWrite === '可写'
        ? '可直接写入'
        : payload.meta.recommendedWrite === '谨慎可写'
          ? '需要补充后写入'
          : '不建议写入';
    const value = payload.meta.recommendedWrite === '可写' ? '中' : '低';

    const newItem: AnalyzedExperience = {
      id,
      type: '难写经历',
      answers: {
        原始描述: payload.raw,
        ...payload.qa,
      },
      ability,
      module: payload.meta.recommendedModule || '项目与实践经历',
      value,
      status,
      details: {
        reason: payload.meta.riskWarning || '请确保内容真实可证明',
        suggestion:
          payload.meta.doNotExaggerate.join('；') ||
          payload.meta.missingQuestions.join('；') ||
          '必要时补充可证明的细节',
        optimizedText: payload.chosenText,
      },
    };

    setExperiencePool((prev) => [newItem, ...prev]);
    setSelectedExpIds((prev) => [id, ...prev]);
    setActiveExpId(id);
    setStep(3);
  };

  const handleExtract = async () => {
    if (experiences.length === 0) return;
    setIsGenerating(true);
    setStep(3);
    
    try {
      const prompt = `你是一个资深HR和简历专家。现在用户提供了以下经历原始素材。
目标岗位是：【${jobTitle}】（${jobStage}，${resolvedJobDirection}方向）。
当前用户的简历状态是：${currentStatus.join('、') || '无'}。
目标JD（可选）：${targetJD || '无'}

请你对以下每段经历进行分析，评估其对目标岗位的价值，并给出优化建议。
原始经历数据：
${JSON.stringify(experiences, null, 2)}

请返回 JSON 格式，包含一个 "analyzedExperiences" 数组。数组中的每个对象需要包含以下字段：
- id: 必须与输入中的 id 完全一致 (string)
- type: 必须与输入中的 type 完全一致 (string)
- answers: 必须与输入中的 answers 完全一致 (object)
- ability: 提炼该经历展现的核心能力 (string，如"团队协作、问题解决、数据分析")
- module: 推荐放入简历的哪个模块 (string，如"项目经历"、"工作经历"、"校园经历")
- value: 该经历对目标岗位的价值评级 (string，必须是 "高" | "中" | "低")
- status: 写入建议 (string，必须是 "可直接写入" | "需要补充后写入" | "可弱化写入" | "不建议写入")
- details: 对象，包含：
  - reason: 评估理由 (string)
  - suggestion: 优化建议 (string)
  - optimizedText: 优化后的推荐表达，要求是一段符合 STAR 法则的专业文字描述 (string)
`;
      const systemPrompt = "你是一个专业的简历评估与优化专家，严格按照要求返回合法的 JSON 数据。";

      const response = await generateJSON<{ analyzedExperiences: AnalyzedExperience[] }>(prompt, systemPrompt);
      const analyzed = response.analyzedExperiences;
      
      setExperiencePool(prev => [...prev, ...analyzed]);
      setSelectedExpIds(prev => [...prev, ...analyzed.map(a => a.id)]);
      setExperiences([]); 
    } catch (error) {
      console.error('提取经历失败:', error);
      alert('分析经历时出错，请重试: ' + (error instanceof Error ? error.message : '未知错误'));
      setStep(2);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStep(4);
    
    try {
      const selectedExps = experiencePool.filter(exp => selectedExpIds.includes(exp.id));
      const finalTitle = jobTitle || resolvedJobDirection || '未命名岗位';
      
      const messages: { role: 'system' | 'user' | 'assistant', content: string }[] = [
        {
          role: 'system',
          content: '你是一个资深简历定制专家，擅长根据用户的经历素材和目标岗位，使用 Markdown 格式输出专业排版的简历初稿。请直接输出 Markdown 文本，不要在开头和结尾包裹 ```markdown 标签。'
        },
        {
          role: 'user',
          content: `请为我生成一份简历 Markdown 初稿。
目标岗位：${finalTitle} (${jobStage})
期望版本风格：${resumeVersion}
目标JD（如果有，请针对性优化关键词）：${targetJD || '无'}

以下是用户选中的经历素材及其评估详情（请充分参考其中的 optimizedText 进行专业化重写，并使用 STAR 法则分点列出）：
${JSON.stringify(selectedExps, null, 2)}

Markdown 结构要求如下（如果没有足够的经历，请根据岗位合理推断基础框架）：
# 个人简历

## 目标岗位
**${finalTitle}** (${jobStage})
*版本风格：${resumeVersion}*

## 教育背景
**某某大学** | 计算机科学与技术 | 本科
*2020.09 - 2024.06*

## 项目与实践经历
（请在这里展开撰写）

## 专业技能
（结合目标岗位、JD和经历，推断并列出适合的专业技能，3-5点）
`
        }
      ];

      let initialMarkdown = await callLLM(messages);
      initialMarkdown = initialMarkdown.replace(/^```markdown\n?/, '').replace(/\n?```$/, '');

      const resumeId = await createResume(`${finalTitle} 简历初稿`, finalTitle, initialMarkdown, {
        targetStage: jobStage || undefined,
        targetDirection: resolvedJobDirection,
        source: 'ai-draft',
        variantLabel: resumeVersion,
        jobWritingMap: jobWritingMap ?? undefined,
      });
      router.push(`/editor/${resumeId}`);
    } catch (error) {
      console.error('生成简历失败:', error);
      alert('生成简历时出错，请重试: ' + (error instanceof Error ? error.message : '未知错误'));
      setStep(3);
    } finally {
      setIsGenerating(false);
    }
  };

  const isStep1Valid = jobStage && jobDirection && (jobDirection !== '其他' || jobDirectionCustom) && jobTitle;

  const handleFillStep1Example = () => {
    setJobStage('实习');
    setJobDirection('技术');
    setJobTitle('前端开发实习生');
    setTargetJD('1. 熟悉 HTML/CSS/JavaScript，了解 ES6 及以上规范。\n2. 熟练使用 React 框架，了解其核心原理。\n3. 了解前端工程化，有 Webpack/Vite 实际使用经验。\n4. 具备良好的沟通能力和团队协作精神。');
    setCurrentStatus(['简历很空']);
  };

  const handleFillStep2Example = () => {
    if (activeExpType === '课程项目') {
      setCurrentAnswers({
        '项目主题是什么？': '基于 React 的校园二手交易平台',
        '是几个人完成的？': '3人小组，我担任组长',
        '你负责哪一部分？': '前端核心模块开发，包括商品列表、详情页和发布表单',
        '用了哪些工具、技术或方法？': 'React, React Router, Zustand, TailwindCSS',
        '最难的地方是什么？你怎么解决的？': '商品列表图片加载慢。我引入了懒加载机制和图片压缩，提升了加载速度。',
        '最后产出了什么？': '一个完整可运行的网页端应用',
        '有没有评分、用户、数据、展示、上线？': '获得了课程期末大作业第一名（95分）'
      });
    } else if (activeExpType === '校园活动') {
      setCurrentAnswers({
        '活动目标是什么？': '举办全校级别的技术分享讲座',
        '你负责策划、宣传、执行、社群还是数据？': '统筹策划和线上宣传',
        '面向多少人？': '全校计算机学院及相关专业学生',
        '你做了哪些具体动作？': '联系了3位行业大牛作为讲师，制作了宣传海报并在各社群分发，建立了报名群并每天活跃气氛。',
        '活动结果如何？': '讲座非常成功',
        '有没有报名人数、到场人数、推文阅读量？': '推文阅读量破3000，报名人数超过500人，实际到场300多人。'
      });
    } else if (activeExpType === '实习/兼职') {
      setCurrentAnswers({
        '公司名称和岗位是什么？': '某某科技网络有限公司 / 前端开发实习生',
        '你的日常工作内容有哪些？': '负责公司内部管理后台的日常页面开发和维护',
        '你主导或参与了什么重要项目？': '参与了员工权限管理模块的重构',
        '有哪些可量化的工作成果？': '将原来的老旧 jQuery 页面重构为 Vue3 页面，页面加载速度提升了 40%，代码量减少了 30%。'
      });
    } else {
      // 默认兜底示例
      const defaultAnswers: Record<string, string> = {};
      EXP_QUESTIONS[activeExpType].forEach((q) => {
        defaultAnswers[q] = `这是关于“${q}”的示例回答内容...`;
      });
      setCurrentAnswers(defaultAnswers);
    }
  };

  return (
    <div className="aurora-workspace h-screen text-[#EAF6FF] flex flex-col font-sans overflow-hidden">
      <header className="min-h-14 bg-white border-b border-[#E5E7EB] grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 md:px-6 py-3 shrink-0 z-10">
        <button 
          onClick={() => router.push('/')} 
          className="flex items-center text-[#6B7280] hover:text-[#1F2933] transition-colors text-sm font-medium whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          回到首页
        </button>
        <div className="justify-self-center flex items-center min-w-0">
          <Compass className="w-4 h-4 mr-2 text-[#235C4E]" />
          <span className="font-semibold text-[14px] truncate">制作一份新简历</span>
        </div>
        <div className="hidden sm:block w-[100px]"></div>
      </header>

      <div className="md:hidden bg-white border-b border-[#E5E7EB] px-4 py-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {steps.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-[12px] ${
                step === s.id
                  ? 'border-[#235C4E] bg-[#235C4E]/5 text-[#235C4E]'
                  : step > s.id
                    ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#2F855A]'
                    : 'border-[#E5E7EB] bg-white text-[#6B7280]'
              }`}
            >
              {step > s.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{s.id}</span>}
              <span className="font-medium">{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Steps */}
        <div className="w-[280px] bg-white border-r border-[#E5E7EB] p-6 hidden md:block shrink-0">
          <h3 className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wider mb-6">
            制作步骤
          </h3>
          <div className="space-y-6">
            {steps.map((s, i) => (
              <div key={s.id} className="relative">
                {i !== steps.length - 1 && (
                  <div className={`absolute left-3 top-8 bottom-[-24px] w-[1px] ${step > s.id ? 'bg-[#235C4E]' : 'bg-[#E5E7EB]'}`} />
                )}
                <div className="flex items-start">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border text-[12px] font-medium z-10 transition-colors ${
                    step > s.id 
                      ? 'bg-[#235C4E] border-[#235C4E] text-white' 
                      : step === s.id 
                        ? 'bg-white border-[#235C4E] text-[#235C4E] ring-4 ring-[#235C4E]/10' 
                        : 'bg-white border-[#E5E7EB] text-[#6B7280]'
                  }`}>
                    {step > s.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.id}
                  </div>
                  <div className="ml-4">
                    <h4 className={`text-[14px] font-semibold ${step >= s.id ? 'text-[#1F2933]' : 'text-[#6B7280]'}`}>
                      {s.title}
                    </h4>
                    <p className="text-[12px] text-[#6B7280] mt-1">{s.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Main Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 flex justify-center">
          <div className={`${step === 3 ? 'max-w-6xl' : 'max-w-4xl'} w-full`}>
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-8 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
                    <div>
                      <h2 className="text-[24px] font-semibold mb-3">你要投递什么岗位？</h2>
                      <p className="text-[#6B7280] text-[14px]">
                        明确目标，我们才能帮你提炼最相关的经历。
                      </p>
                    </div>
                    <button
                      onClick={handleFillStep1Example}
                      className="px-3 py-1.5 text-[12px] font-medium text-[#235C4E] bg-[#F0FDF4] border border-[#BBF7D0] rounded-md hover:bg-[#DCFCE7] transition-colors"
                    >
                      填入示例
                    </button>
                  </div>
                  
                  <div className="space-y-8">
                    <div>
                      <label className="block text-[14px] font-medium text-[#1F2933] mb-3">求职阶段 <span className="text-red-500">*</span></label>
                      <div className="flex flex-wrap gap-3">
                        {['实习', '校招', '转专业', '零经验'].map(stage => (
                          <label key={stage} className={`flex items-center px-4 py-2 border rounded-lg cursor-pointer transition-colors ${jobStage === stage ? 'border-[#235C4E] bg-[#235C4E]/5 text-[#235C4E]' : 'border-[#E5E7EB] hover:bg-[#F7F8F6]'}`}>
                            <input type="radio" name="jobStage" value={stage} checked={jobStage === stage} onChange={(e) => setJobStage(e.target.value as JobStage)} className="hidden" />
                            <span className="text-[14px]">{stage}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[14px] font-medium text-[#1F2933] mb-3">岗位方向 <span className="text-red-500">*</span></label>
                      <div className="flex flex-wrap gap-3">
                        {['技术', '产品', '运营', '市场', '数据', '设计', '通用', '其他'].map(dir => (
                          <label key={dir} className={`flex items-center px-4 py-2 border rounded-lg cursor-pointer transition-colors ${jobDirection === dir ? 'border-[#235C4E] bg-[#235C4E]/5 text-[#235C4E]' : 'border-[#E5E7EB] hover:bg-[#F7F8F6]'}`}>
                            <input type="radio" name="jobDirection" value={dir} checked={jobDirection === dir} onChange={(e) => setJobDirection(e.target.value as JobDirection)} className="hidden" />
                            <span className="text-[14px]">{dir}</span>
                          </label>
                        ))}
                      </div>
                      {jobDirection === '其他' && (
                        <input 
                          type="text" 
                          placeholder="请输入您的岗位方向"
                          className="mt-3 w-full p-3 bg-[#F7F8F6] border border-[#E5E7EB] rounded-lg focus:ring-1 focus:ring-[#235C4E] focus:border-[#235C4E] outline-none transition-all text-[14px]"
                          value={jobDirectionCustom}
                          onChange={e => setJobDirectionCustom(e.target.value)}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[14px] font-medium text-[#1F2933] mb-3">目标岗位名称 <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        placeholder="例如：产品运营实习生、前端开发工程师"
                        className="w-full p-3 bg-[#F7F8F6] border border-[#E5E7EB] rounded-lg focus:ring-1 focus:ring-[#235C4E] focus:border-[#235C4E] outline-none transition-all text-[14px]"
                        value={jobTitle}
                        onChange={e => setJobTitle(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[14px] font-medium text-[#1F2933] mb-3">目标 JD (选填)</label>
                      <textarea 
                        rows={4}
                        placeholder="粘贴你想投递的岗位描述(JD)，AI 将为你进行精准匹配"
                        className="w-full p-3 bg-[#F7F8F6] border border-[#E5E7EB] rounded-lg focus:ring-1 focus:ring-[#235C4E] focus:border-[#235C4E] outline-none transition-all text-[14px] resize-none"
                        value={targetJD}
                        onChange={e => setTargetJD(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[14px] font-medium text-[#1F2933] mb-3">当前简历状态 (多选)</label>
                      <div className="flex flex-wrap gap-3">
                        {STATUS_OPTIONS.map(status => (
                          <label key={status} className={`flex items-center px-4 py-2 border rounded-lg cursor-pointer transition-colors ${currentStatus.includes(status) ? 'border-[#235C4E] bg-[#235C4E]/5 text-[#235C4E]' : 'border-[#E5E7EB] hover:bg-[#F7F8F6]'}`}>
                            <input type="checkbox" checked={currentStatus.includes(status)} onChange={() => handleStatusToggle(status)} className="hidden" />
                            <span className="text-[14px]">{status}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-8 mt-8 border-t border-[#E5E7EB]">
                    <button 
                      disabled={!isStep1Valid}
                      onClick={() => setStep(2)}
                      className="px-6 py-2.5 bg-[#235C4E] text-white text-[14px] rounded-lg font-medium disabled:opacity-50 hover:bg-[#1a453a] transition-colors"
                    >
                      下一步
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-8 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
                    <div>
                      <h2 className="text-[24px] font-semibold mb-3">经历挖掘</h2>
                      <p className="text-[#6B7280] text-[14px]">
                        选择经历类型，回答几个简单的问题，AI 会帮你转化为专业表达。
                      </p>
                    </div>
                    <button
                      onClick={() => setIsTransformerOpen(true)}
                      disabled={!jobTitle || !jobStage || !resolvedJobDirection}
                      className="flex items-center justify-center gap-2 px-3 py-2 text-[12px] font-medium text-[#235C4E] bg-[#F0FDF4] border border-[#BBF7D0] rounded-md hover:bg-[#DCFCE7] transition-colors disabled:opacity-50 disabled:hover:bg-[#F0FDF4]"
                    >
                      <Lightbulb className="w-4 h-4" />
                      难写经历转化器
                    </button>
                  </div>
                  
                  {/* Experience Type Cards */}
                  {!activeExpType && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                      {EXP_TYPES.map(type => (
                        <button
                          key={type.id}
                          onClick={() => { setActiveExpType(type.id); setCurrentAnswers({}); }}
                          className="flex flex-col items-center justify-center p-6 bg-white border border-[#E5E7EB] rounded-xl hover:border-[#235C4E] hover:shadow-sm transition-all text-center group"
                        >
                          <div className="w-12 h-12 bg-[#F7F8F6] rounded-full flex items-center justify-center text-[#6B7280] group-hover:text-[#235C4E] group-hover:bg-[#235C4E]/5 transition-colors mb-3">
                            {type.icon}
                          </div>
                          <span className="text-[14px] font-medium text-[#1F2933]">{type.id}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Active Experience Form */}
                  {activeExpType && (
                    <div className="mb-8 p-4 md:p-6 bg-[#F7F8F6] rounded-xl border border-[#E5E7EB]">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[16px] font-semibold flex items-center text-[#235C4E]">
                            {EXP_TYPES.find(t => t.id === activeExpType)?.icon}
                            <span className="ml-2">添加{activeExpType}</span>
                          </h3>
                          <button
                            onClick={handleFillStep2Example}
                            className="px-2.5 py-1 text-[12px] font-medium text-[#235C4E] bg-[#F0FDF4] border border-[#BBF7D0] rounded-md hover:bg-[#DCFCE7] transition-colors"
                          >
                            填入示例
                          </button>
                        </div>
                        <button onClick={() => setActiveExpType('')} className="text-[#6B7280] hover:text-[#1F2933] text-[13px]">
                          取消
                        </button>
                      </div>
                      
                      <div className="space-y-5">
                        {EXP_QUESTIONS[activeExpType].map((q, idx) => (
                          <div key={idx}>
                            <label className="block text-[14px] font-medium text-[#1F2933] mb-2">{idx + 1}. {q}</label>
                            <textarea 
                              rows={2}
                              className="w-full p-3 bg-white border border-[#E5E7EB] rounded-lg focus:ring-1 focus:ring-[#235C4E] focus:border-[#235C4E] outline-none transition-all text-[14px] resize-none"
                              value={currentAnswers[q] || ''}
                              onChange={e => setCurrentAnswers({...currentAnswers, [q]: e.target.value})}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 flex justify-end">
                        <button
                          onClick={handleAddExperience}
                          className="px-5 py-2 bg-[#235C4E] text-white text-[14px] rounded-lg font-medium hover:bg-[#1a453a] transition-colors"
                        >
                          保存经历
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Saved Experiences List */}
                  {experiences.length > 0 && (
                    <div className="mb-8">
                      <h4 className="text-[15px] font-semibold mb-4 text-[#1F2933]">已添加的经历 ({experiences.length})</h4>
                      <div className="space-y-3">
                        {experiences.map((exp) => (
                          <div key={exp.id} className="flex items-center justify-between p-4 bg-white border border-[#E5E7EB] rounded-lg">
                            <div>
                              <span className="inline-block px-2 py-1 bg-[#F7F8F6] text-[#6B7280] text-[12px] rounded-md mb-2">
                                {exp.type}
                              </span>
                              <p className="text-[14px] text-[#1F2933] line-clamp-1">
                                {Object.values(exp.answers).find(v => v.trim() !== '') || '未填写内容'}
                              </p>
                            </div>
                            <button onClick={() => handleDeleteExperience(exp.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-6 border-t border-[#E5E7EB]">
                    <button 
                      onClick={() => setStep(1)}
                      className="px-4 py-2.5 text-[#6B7280] hover:text-[#1F2933] text-[14px] font-medium transition-colors"
                    >
                      返回上一步
                    </button>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {experiencePool.length > 0 && (
                        <button 
                          onClick={() => setStep(3)}
                          className="px-4 py-2.5 text-[#235C4E] hover:bg-[#235C4E]/5 text-[14px] rounded-lg font-medium transition-colors"
                        >
                          返回经历池 ({experiencePool.length})
                        </button>
                      )}
                      <button 
                        disabled={experiences.length === 0 || isGenerating}
                        onClick={handleExtract}
                        className="px-6 py-2.5 bg-[#235C4E] text-white text-[14px] rounded-lg font-medium disabled:opacity-50 hover:bg-[#1a453a] transition-colors flex items-center shadow-sm"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            提取中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            {experiencePool.length > 0 ? '提取并前往经历池' : '生成可写经历池'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-8 shadow-sm w-full mx-auto"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6">
                    <div>
                      <h2 className="text-[24px] font-semibold mb-2">可写经历池</h2>
                      <p className="text-[#6B7280] text-[14px]">
                        转化与选择经历素材。我们会评估每段经历的价值，帮助你做出筛选。
                      </p>
                    </div>
                    <button
                      onClick={() => setIsTransformerOpen(true)}
                      disabled={!jobTitle || !jobStage || !resolvedJobDirection}
                      className="flex items-center justify-center gap-2 px-3 py-2 text-[12px] font-medium text-[#235C4E] bg-[#F0FDF4] border border-[#BBF7D0] rounded-md hover:bg-[#DCFCE7] transition-colors disabled:opacity-50 disabled:hover:bg-[#F0FDF4]"
                    >
                      <Lightbulb className="w-4 h-4" />
                      难写经历转化器
                    </button>
                  </div>

                  {/* 经历价值排序 Hint */}
                  <div className="mb-6 p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg flex items-start">
                    <Shield className="w-5 h-5 text-[#2F855A] mr-3 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[14px] font-semibold text-[#2F855A] mb-1">经历价值排序</h4>
                      <p className="text-[13px] text-[#2F855A]/80">
                        AI 会根据您的目标岗位，自动评估经历匹配度。建议优先勾选【高价值】和【中价值】经历。若高价值经历不足，可使用【需补充后写入】的素材。
                      </p>
                    </div>
                  </div>
                  
                  {isGenerating ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-[#235C4E] animate-spin mb-4" />
                      <p className="text-[#6B7280] text-[14px]">正在分析并转化您的经历...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto mb-8 border border-[#E5E7EB] rounded-lg">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="bg-[#F7F8F6] border-b border-[#E5E7EB] text-[#6B7280]">
                            <th className="p-4 font-medium w-12">
                              <input 
                                type="checkbox"
                                className="rounded border-[#E5E7EB] text-[#235C4E] focus:ring-[#235C4E]"
                                checked={experiencePool.length > 0 && selectedExpIds.length === experiencePool.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedExpIds(experiencePool.map(ex => ex.id));
                                  } else {
                                    setSelectedExpIds([]);
                                  }
                                }}
                              />
                            </th>
                            <th className="p-4 font-medium min-w-[200px]">原始经历</th>
                            <th className="p-4 font-medium min-w-[120px]">可证明能力</th>
                            <th className="p-4 font-medium min-w-[100px]">推荐模块</th>
                            <th className="p-4 font-medium min-w-[80px]">价值等级</th>
                            <th className="p-4 font-medium min-w-[120px]">写入状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {experiencePool.map((exp) => {
                            const firstAnswer = Object.values(exp.answers).find(v => v.trim() !== '') || '未填写具体内容';
                            
                            const valueColors = {
                              '高': 'text-[#2F855A]',
                              '中': 'text-[#D97706]',
                              '低': 'text-[#DC2626]'
                            };

                            const statusStyles = {
                              '可直接写入': 'bg-[#F0FDF4] text-[#2F855A] border-[#BBF7D0]',
                              '需要补充后写入': 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]',
                              '可弱化写入': 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]',
                              '不建议写入': 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                            };

                            return (
                              <tr 
                                key={exp.id} 
                                className={`border-b border-[#E5E7EB] last:border-0 hover:bg-[#F7F8F6]/50 cursor-pointer ${activeExpId === exp.id ? 'bg-[#235C4E]/5' : ''}`}
                                onClick={() => setActiveExpId(exp.id)}
                              >
                                <td className="p-4" onClick={e => e.stopPropagation()}>
                                  <input 
                                    type="checkbox"
                                    className="rounded border-[#E5E7EB] text-[#235C4E] focus:ring-[#235C4E]"
                                    checked={selectedExpIds.includes(exp.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedExpIds(prev => [...prev, exp.id]);
                                      } else {
                                        setSelectedExpIds(prev => prev.filter(id => id !== exp.id));
                                      }
                                    }}
                                  />
                                </td>
                                <td className="p-4">
                                  <div className="text-[#1F2933] font-medium mb-1">{exp.type}</div>
                                  <div className="text-[#6B7280] text-[12px] line-clamp-2">{firstAnswer}</div>
                                </td>
                                <td className="p-4 text-[#6B7280]">{exp.ability}</td>
                                <td className="p-4 text-[#1F2933]">{exp.module}</td>
                                <td className="p-4">
                                  <span className={`font-semibold ${valueColors[exp.value]}`}>{exp.value}</span>
                                </td>
                                <td className="p-4">
                                  <span className={`px-2.5 py-1 border rounded-md text-[11px] font-medium ${statusStyles[exp.status]}`}>
                                    {exp.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-6 border-t border-[#E5E7EB]">
                    <button 
                      onClick={() => setStep(2)}
                      className="px-4 py-2.5 text-[#6B7280] hover:text-[#1F2933] text-[14px] font-medium transition-colors flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      继续添加经历
                    </button>
                    <button 
                      disabled={isGenerating || selectedExpIds.length === 0}
                      onClick={() => setStep(4)}
                      className="px-6 py-2.5 bg-[#235C4E] text-white text-[14px] rounded-lg font-medium disabled:opacity-50 hover:bg-[#1a453a] transition-colors flex items-center shadow-sm"
                    >
                      下一步，生成简历
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div 
                  key="step4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-8 shadow-sm"
                >
                  <h2 className="text-[24px] font-semibold mb-3">岗位化生成</h2>
                  <p className="text-[#6B7280] text-[14px] mb-8">
                    最后一步！选择您期望的表达风格，AI 将为您生成完整的 Markdown 简历初稿。
                  </p>

                  <div className="mb-8">
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-3">多版本表达选择</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {VERSION_OPTIONS.map(ver => (
                        <label key={ver} className={`flex items-center justify-center p-4 border rounded-xl cursor-pointer transition-all ${resumeVersion === ver ? 'border-[#235C4E] bg-[#235C4E]/5 text-[#235C4E] shadow-sm' : 'border-[#E5E7EB] hover:bg-[#F7F8F6] text-[#6B7280]'}`}>
                          <input type="radio" name="resumeVersion" value={ver} checked={resumeVersion === ver} onChange={(e) => setResumeVersion(e.target.value)} className="hidden" />
                          <span className="text-[14px] font-medium">{ver}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 空白简历补全(A7) Hint & 7-Day Task List */}
                  {selectedExpIds.length < 2 && (
                    <div className="mb-8 space-y-4">
                      {/* A7 原有提示框 */}
                      <div className="p-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg flex items-start">
                        <Zap className="w-5 h-5 text-[#D97706] mr-3 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-[14px] font-semibold text-[#D97706] mb-1">空白简历补全 (A7)</h4>
                          <p className="text-[13px] text-[#D97706]/80">
                            系统检测到您选中的经历不足2条。别担心！AI 将根据您的目标岗位和专业背景，自动填充合理的技能树和通用的基础校园经历框架，为您提供灵感。
                          </p>
                        </div>
                      </div>
                      
                      {/* A7 7-Day Task List */}
                      <div className="p-4 md:p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-sm">
                        <div className="flex items-center mb-4">
                          <div className="w-8 h-8 bg-[#235C4E]/10 rounded-full flex items-center justify-center mr-3">
                            <Activity className="w-4 h-4 text-[#235C4E]" />
                          </div>
                          <div>
                            <h4 className="text-[15px] font-semibold text-[#1F2933]">7天破局任务清单</h4>
                            <p className="text-[12px] text-[#6B7280]">没有经历？跟着清单，7天内无中生有打造一个硬核项目</p>
                          </div>
                        </div>
                        
                        <div className="grid gap-3">
                          <div className="flex items-start p-3.5 rounded-lg bg-[#F7F8F6] border border-[#E5E7EB] hover:border-[#235C4E]/30 transition-colors group">
                            <div className="w-7 h-7 rounded-full bg-[#235C4E]/10 text-[#235C4E] flex items-center justify-center text-[12px] font-bold shrink-0 mr-3 group-hover:bg-[#235C4E] group-hover:text-white transition-colors">
                              1-2
                            </div>
                            <div>
                              <h5 className="text-[13px] font-semibold text-[#1F2933] mb-1">拆解 JD，速成核心工具</h5>
                              <p className="text-[12px] text-[#6B7280] leading-relaxed">
                                找到目标岗位高频出现的2-3个核心工具或技能，花两天时间看教程并掌握基础操作，能够做出最简单的 Demo。
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start p-3.5 rounded-lg bg-[#F7F8F6] border border-[#E5E7EB] hover:border-[#235C4E]/30 transition-colors group">
                            <div className="w-7 h-7 rounded-full bg-[#235C4E]/10 text-[#235C4E] flex items-center justify-center text-[12px] font-bold shrink-0 mr-3 group-hover:bg-[#235C4E] group-hover:text-white transition-colors">
                              3-5
                            </div>
                            <div>
                              <h5 className="text-[13px] font-semibold text-[#1F2933] mb-1">像素级模仿，产出微型作品</h5>
                              <p className="text-[12px] text-[#6B7280] leading-relaxed">
                                根据所学工具，找一个行业经典案例进行复刻。如：一份竞品分析报告初稿、一个静态网页、或一份基础数据看板。
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start p-3.5 rounded-lg bg-[#F7F8F6] border border-[#E5E7EB] hover:border-[#235C4E]/30 transition-colors group">
                            <div className="w-7 h-7 rounded-full bg-[#235C4E]/10 text-[#235C4E] flex items-center justify-center text-[12px] font-bold shrink-0 mr-3 group-hover:bg-[#235C4E] group-hover:text-white transition-colors">
                              6-7
                            </div>
                            <div>
                              <h5 className="text-[13px] font-semibold text-[#1F2933] mb-1">提炼数据，写入简历经历池</h5>
                              <p className="text-[12px] text-[#6B7280] leading-relaxed">
                                将作品上传至 GitHub 或在线文档生成链接。用 STAR 法则将其包装为“个人项目”，提取至少2个数据化结果写入简历。
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isGenerating ? (
                    <div className="flex flex-col items-center justify-center py-12 border border-[#E5E7EB] rounded-xl bg-[#F7F8F6]">
                      <Loader2 className="w-10 h-10 text-[#235C4E] animate-spin mb-6" />
                      <h2 className="text-[18px] font-semibold mb-2">正在生成【{resumeVersion}】简历...</h2>
                      <p className="text-[#6B7280] text-[14px]">
                        正在提取您的核心贡献，匹配【{jobTitle}】岗位关键词。
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-6 border-t border-[#E5E7EB]">
                      <button 
                        onClick={() => setStep(3)}
                        className="px-4 py-2.5 text-[#6B7280] hover:text-[#1F2933] text-[14px] font-medium transition-colors"
                      >
                        返回修改
                      </button>
                      <button 
                        onClick={handleGenerate}
                        className="px-8 py-3 bg-[#235C4E] text-white text-[15px] rounded-lg font-medium hover:bg-[#1a453a] transition-all flex items-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                      >
                        <Sparkles className="w-5 h-5 mr-2" />
                        立即生成
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Sidebar: AI Assistant & Maps */}
        <div className="w-[320px] bg-white border-l border-[#E5E7EB] hidden lg:flex flex-col shrink-0">
          <div className="h-12 bg-[#F7F8F6] border-b border-[#E5E7EB] flex items-center px-5 shrink-0">
            <Sparkles className="w-4 h-4 mr-2 text-[#235C4E]" />
            <span className="text-[13px] font-semibold text-[#1F2933]">北极星助手</span>
          </div>
          <div className="p-5 flex-1 overflow-y-auto">
            {step === 1 && (
              <div className="space-y-4">
                <div className="bg-[#235C4E]/5 p-4 rounded-xl border border-[#235C4E]/10">
                  <h4 className="text-[14px] font-bold text-[#235C4E] mb-3 flex items-center">
                    <LayoutTemplate className="w-4 h-4 mr-2" />
                    岗位写作地图
                  </h4>
                  <div className="space-y-4 text-[13px]">
                    <JobWritingMapPanel
                      map={jobWritingMap}
                      isLoading={isGeneratingJobWritingMap}
                      error={jobWritingMapError}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {step === 2 && (
              <div className="bg-[#F7F8F6] p-4 rounded-lg border border-[#E5E7EB] text-[13px] leading-relaxed text-[#1F2933]">
                <p className="mb-3 font-semibold text-[#235C4E] flex items-center">
                  <Lightbulb className="w-4 h-4 mr-2" />
                  挖掘提示
                </p>
                <p className="mb-2">尝试用大白话回答问题，无需担心文笔。我们的 AI 会帮你：</p>
                <ul className="list-disc pl-4 space-y-1 text-[#6B7280]">
                  <li>提炼 STAR 法则结构</li>
                  <li>使用专业行业术语替换</li>
                  <li>突出数据和可量化成果</li>
                </ul>
              </div>
            )}
            
            {step === 3 && (
              <div className="space-y-4">
                {activeExpId && experiencePool.find(e => e.id === activeExpId) ? (() => {
                  const activeExp = experiencePool.find(e => e.id === activeExpId)!;
                  return (
                    <div className="bg-[#235C4E]/5 p-4 rounded-xl border border-[#235C4E]/10">
                      <h4 className="text-[14px] font-bold text-[#235C4E] mb-3 flex items-center">
                        <Sparkles className="w-4 h-4 mr-2" />
                        经历评估详情
                      </h4>
                      <div className="space-y-4 text-[13px]">
                        <div>
                          <p className="font-semibold text-[#1F2933] mb-1">📊 评估理由</p>
                          <p className="text-[#6B7280]">{activeExp.details.reason}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-[#1F2933] mb-1">💡 优化建议</p>
                          <p className="text-[#6B7280]">{activeExp.details.suggestion}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-[#1F2933] mb-1">✨ 推荐表达</p>
                          <p className="text-[#6B7280]">{activeExp.details.optimizedText}</p>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="bg-[#F7F8F6] p-4 rounded-lg border border-[#E5E7EB] text-[13px] leading-relaxed text-[#1F2933]">
                    <p className="mb-3 font-semibold text-[#235C4E]">筛选建议</p>
                    <p>
                      建议保留价值等级为“高”和“中”的经历。点击左侧表格中的任意经历，可在此查看 AI 提供的详细评估与优化建议。
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {step === 4 && (
              <div className="bg-[#F7F8F6] p-4 rounded-lg border border-[#E5E7EB] text-[13px] leading-relaxed text-[#1F2933]">
                <p className="mb-3 font-semibold text-[#235C4E]">版本说明</p>
                <ul className="space-y-2 text-[#6B7280]">
                  <li><strong className="text-[#1F2933]">保守版:</strong> 稳妥表达，适合传统行业。</li>
                  <li><strong className="text-[#1F2933]">强化版:</strong> 突出成就与数据，互联网首选。</li>
                  <li><strong className="text-[#1F2933]">技术版:</strong> 侧重工具栈和架构设计。</li>
                  <li><strong className="text-[#1F2933]">产品版:</strong> 侧重用户价值和迭代过程。</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <ExperienceTransformerDialog
        open={isTransformerOpen}
        onClose={() => setIsTransformerOpen(false)}
        context={{
          jobTitle,
          jobStage: jobStage || '未知',
          jobDirection: resolvedJobDirection || '未知',
          targetJD,
        }}
        onAddToPool={handleAddTransformedExperience}
      />
    </div>
  );
}
