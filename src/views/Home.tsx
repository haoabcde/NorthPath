'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FileEdit, Compass, Clock, Plus, Target, Shield, Trash2, Settings } from 'lucide-react';
import { useEffect } from 'react';
import { useResumeStore } from '../store/useResumeStore';
import { useSettingsStore } from '../store/useSettingsStore';

export default function Home() {
  const router = useRouter();
  const { resumes, loadResumes, clearAllData } = useResumeStore();
  const { openDialog } = useSettingsStore();

  useEffect(() => {
    loadResumes();
  }, [loadResumes]);

  const handleClearData = async () => {
    if (window.confirm('确定要清除所有本地数据吗？此操作不可恢复。')) {
      await clearAllData();
      window.location.reload(); // 刷新页面以彻底重置
    }
  };

  return (
    <div className="aurora-page min-h-screen text-[#EAF6FF] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      <button 
        onClick={openDialog}
        className="absolute top-6 right-6 p-2 text-[#6B7280] hover:text-[#235C4E] hover:bg-[#E5E7EB]/50 rounded-full transition-all"
        title="API 设置"
      >
        <Settings className="w-6 h-6" />
      </button>

      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl w-full"
      >
        <div className="text-center mb-14">
          <div className="inline-flex items-center justify-center p-3 rounded-full mb-4 border border-[#E5E7EB] bg-white shadow-sm">
            <Compass className="w-8 h-8 text-[#235C4E]" strokeWidth={1.5} />
          </div>
          <h1 className="text-[32px] md:text-[40px] font-bold mb-3 tracking-tight text-[#1F2933]">
            NorthPath 北极星
          </h1>
          <p className="text-[#6B7280] text-[16px] md:text-[18px] max-w-2xl mx-auto font-medium">
            把普通大学经历，变成适合目标岗位的简历。
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => router.push('/builder')}
            className="aurora-card flex flex-col items-start p-8 border rounded-lg shadow-sm hover:shadow-md hover:border-[#45F6D0]/40 transition-all text-left group"
          >
            <div className="flex items-center justify-between w-full mb-4">
              <div className="p-2.5 bg-[#F7F8F6] rounded-lg border border-[#E5E7EB]">
                <Plus className="w-6 h-6 text-[#235C4E]" strokeWidth={1.5} />
              </div>
            </div>
            <h2 className="text-[20px] font-semibold mb-3 text-[#1F2933]">制作一份新简历</h2>
            <p className="text-[#6B7280] text-[14px] leading-relaxed mb-6 flex-1">
              适合没有简历、简历很空、不知道经历怎么写的学生。
            </p>
            <div className="mt-auto px-5 py-2.5 bg-[#235C4E] text-white text-[14px] font-medium rounded-lg hover:bg-[#1a453a] transition-colors w-max">
              开始制作
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => router.push('/calibration')}
            className="aurora-card flex flex-col items-start p-8 border rounded-lg shadow-sm hover:shadow-md hover:border-[#45F6D0]/40 transition-all text-left group"
          >
            <div className="flex items-center justify-between w-full mb-4">
              <div className="p-2.5 bg-[#F7F8F6] rounded-lg border border-[#E5E7EB]">
                <Target className="w-6 h-6 text-[#235C4E]" strokeWidth={1.5} />
              </div>
            </div>
            <h2 className="text-[20px] font-semibold mb-3 text-[#1F2933]">校准已有简历</h2>
            <p className="text-[#6B7280] text-[14px] leading-relaxed mb-6 flex-1">
              上传简历，查看投递准备度、内容短板和修改路线。
            </p>
            <div className="mt-auto px-5 py-2.5 bg-white border border-[#E5E7EB] text-[#1F2933] text-[14px] font-medium rounded-lg group-hover:bg-[#F7F8F6] transition-colors w-max">
              上传校准
            </div>
          </motion.button>
        </div>

        {resumes.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="pt-8 border-t border-[#E5E7EB]/60"
          >
            <h3 className="text-[14px] font-semibold mb-5 flex items-center text-[#6B7280] uppercase tracking-wider">
              最近编辑
            </h3>
            <div className="flex flex-col gap-3">
              {resumes.slice(0, 3).map(resume => (
                <button
                  key={resume.id}
                  onClick={() => router.push(`/editor/${resume.id}`)}
                  className="flex items-center justify-between px-5 py-4 bg-white border border-[#E5E7EB] rounded-xl hover:border-[#235C4E]/40 hover:shadow-sm transition-all text-left group"
                >
                  <div className="flex items-center space-x-4">
                    <FileEdit className="w-4 h-4 text-[#6B7280] group-hover:text-[#235C4E] transition-colors" />
                    <span className="font-medium text-[15px] text-[#1F2933]">{resume.title}</span>
                  </div>
                  <div className="flex items-center text-[13px] text-[#6B7280]">
                    <span className="mr-4 hidden sm:inline-block bg-[#F7F8F6] px-2 py-1 rounded-md border border-[#E5E7EB]">
                      {resume.targetJob}
                    </span>
                    <Clock className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                    {new Date(resume.updatedAt).toLocaleDateString('zh-CN')}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => router.push('/versions')}
            className="px-4 py-2 border border-[#45F6D0]/30 rounded-lg text-[13px] font-medium text-[#45F6D0] bg-[#45F6D0]/10 hover:bg-[#45F6D0]/20 transition-colors"
          >
            打开本地版本库
          </button>
        </div>

        <div className="mt-16 pt-8 border-t border-[#E5E7EB]/60 flex flex-col items-center text-[#6B7280] text-[13px]">
          <div className="flex items-center gap-1.5 mb-4 text-center max-w-lg leading-relaxed">
            <Shield className="w-4 h-4 text-[#235C4E] shrink-0" />
            <span>隐私声明：所有简历数据、校准结果和版本记录均仅保存在您的本地浏览器中，不上传公共服务器。</span>
          </div>
          <button 
            onClick={handleClearData}
            className="flex items-center gap-1.5 text-red-500 hover:text-red-600 transition-colors opacity-80 hover:opacity-100 px-3 py-1.5 rounded hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>一键清除本地数据</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
