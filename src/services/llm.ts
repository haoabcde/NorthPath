import { useSettingsStore } from '../store/useSettingsStore';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callLLM(messages: ChatMessage[]): Promise<string> {
  const { apiKey, baseUrl, model } = useSettingsStore.getState();

  if (!apiKey) {
    throw new Error('未配置 API Key，请先在首页右上角设置中进行配置');
  }

  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      baseUrl,
      apiKey,
      model,
      mode: 'text',
      messages,
      temperature: 0.7,
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

  const data = await response.json();
  return data.content;
}

function parseJsonContent<T>(content: string): T {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error('大模型返回的不是合法的 JSON 格式');
  }
}

export async function generateJSON<T>(prompt: string, systemPrompt: string = "你是一个专业的简历优化助手，请始终返回合法的 JSON 格式数据。"): Promise<T> {
  const { apiKey, baseUrl, model } = useSettingsStore.getState();

  if (!apiKey) {
    throw new Error('未配置 API Key，请先在首页右上角设置中进行配置');
  }

  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      baseUrl,
      apiKey,
      model,
      mode: 'json',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
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

  const data = await response.json();
  const content = data.content;
  return parseJsonContent<T>(content);
}
