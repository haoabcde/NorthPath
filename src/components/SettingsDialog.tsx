'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Settings, Zap, Play, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';

const PRESETS = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { name: 'Kimi (Moonshot)', baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus' },
  { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash' },
];

const COMMON_MODELS = [
  'deepseek-chat', 'deepseek-coder', 
  'moonshot-v1-8k', 'moonshot-v1-32k', 
  'gpt-4o-mini', 'gpt-4o',
  'qwen-plus', 'qwen-max',
  'glm-4-flash', 'glm-4'
];

export default function SettingsDialog() {
  const { isDialogOpen, closeDialog, apiKey, baseUrl, model, setSettings } = useSettingsStore();
  
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localBaseUrl, setLocalBaseUrl] = useState(baseUrl);
  const [localModel, setLocalModel] = useState(model);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    if (isDialogOpen) {
      setLocalApiKey(apiKey);
      setLocalBaseUrl(baseUrl);
      setLocalModel(model);
      setTestResult(null);
      setTestMessage('');
    }
  }, [isDialogOpen, apiKey, baseUrl, model]);

  if (!isDialogOpen) return null;

  const handleTestConnection = async () => {
    if (!localApiKey || !localBaseUrl || !localModel) {
      setTestResult('error');
      setTestMessage('请完整填写 API Base URL、API Key 和 模型名称');
      return;
    }
    
    setIsTesting(true);
    setTestResult(null);
    setTestMessage('');
    
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseUrl: localBaseUrl,
          apiKey: localApiKey,
          model: localModel,
          mode: 'text',
          messages: [{ role: 'user', content: 'hi' }],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        let errorMsg = `请求失败: ${response.status}`;
        const errorData = await response.json().catch(() => null) as { error?: string | { message?: string } } | null;
        if (typeof errorData?.error === 'string') {
          errorMsg = errorData.error;
        } else if (errorData?.error?.message) {
          errorMsg = errorData.error.message;
        }
        throw new Error(errorMsg);
      }

      setTestResult('success');
      setTestMessage('连接成功！模型已就绪。');
    } catch (err) {
      setTestResult('error');
      setTestMessage(err instanceof Error ? err.message : '连接失败，请检查配置或网络');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setSettings({
      apiKey: localApiKey,
      baseUrl: localBaseUrl,
      model: localModel,
    });
    closeDialog();
  };

  return (
    <AnimatePresence>
      <div className="aurora-page fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md max-h-[90vh] bg-white rounded-lg shadow-xl overflow-hidden flex flex-col border border-[#45F6D0]/20"
        >
          <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2 text-[#1F2933]">
              <Settings className="w-5 h-5" />
              <h2 className="text-lg font-semibold">大模型 API 设置</h2>
            </div>
            <button
              onClick={closeDialog}
              className="p-1.5 text-[#6B7280] hover:text-[#1F2933] hover:bg-[#F3F4F6] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto">
            <div className="pb-5 border-b border-[#E5E7EB]">
              <div className="flex items-center text-sm font-medium text-[#4B5563] mb-3">
                <Zap className="w-4 h-4 mr-1.5 text-[#D97706]" /> 快捷配置模板
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setLocalBaseUrl(preset.baseUrl);
                      setLocalModel(preset.defaultModel);
                    }}
                    className="px-2.5 py-1.5 text-xs bg-[#F3F4F6] text-[#4B5563] rounded-md hover:bg-[#E5E7EB] hover:text-[#1F2933] transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#4B5563] mb-1.5">
                API Base URL
              </label>
              <input
                type="text"
                value={localBaseUrl}
                onChange={(e) => setLocalBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#235C4E]/20 focus:border-[#235C4E] transition-all"
              />
              <p className="text-xs text-[#9CA3AF] mt-1.5">兼容 OpenAI 格式的接口地址</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#4B5563] mb-1.5">
                API Key
              </label>
              <input
                type="password"
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#235C4E]/20 focus:border-[#235C4E] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#4B5563] mb-1.5">
                Model 模型名称
              </label>
              <input
                type="text"
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                placeholder="gpt-4o-mini"
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#235C4E]/20 focus:border-[#235C4E] transition-all"
              />
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {COMMON_MODELS.map(m => (
                  <button
                    key={m}
                    onClick={() => setLocalModel(m)}
                    className="text-[11px] px-2 py-1 bg-[#F3F4F6] text-[#6B7280] rounded hover:bg-[#E5E7EB] hover:text-[#1F2933] transition-colors"
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* 测试结果展示区 */}
            {testMessage && (
              <div className={`p-3 rounded-lg flex items-start gap-2 text-[13px] ${
                testResult === 'success' 
                  ? 'bg-[#F0FDF4] text-[#2F855A] border border-[#BBF7D0]' 
                  : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
              }`}>
                {testResult === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{testMessage}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-5 border-t border-[#E5E7EB] bg-[#F9FAFB]">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#235C4E] bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F7F8F6] transition-colors shadow-sm disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              测试连接
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={closeDialog}
                className="px-4 py-2 text-sm font-medium text-[#4B5563] hover:text-[#1F2933] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 bg-[#235C4E] text-white text-sm font-medium rounded-lg hover:bg-[#1a453a] transition-colors"
              >
                <Save className="w-4 h-4" />
                保存配置
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
