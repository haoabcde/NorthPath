import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type AiProxyRequest = {
  baseUrl: string;
  apiKey: string;
  model: string;
  mode: 'text' | 'json';
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
};

const isValidRequest = (body: Partial<AiProxyRequest>): body is AiProxyRequest => {
  return Boolean(
    body.baseUrl &&
      body.apiKey &&
      body.model &&
      (body.mode === 'text' || body.mode === 'json') &&
      Array.isArray(body.messages) &&
      body.messages.every((message) => {
        return (
          (message.role === 'system' || message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string'
        );
      }),
  );
};

export async function POST(request: Request) {
  let body: Partial<AiProxyRequest>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  if (!isValidRequest(body)) {
    return NextResponse.json({ error: '缺少 baseUrl、apiKey、model、mode 或 messages' }, { status: 400 });
  }

  const baseUrl = body.baseUrl.replace(/\/+$/, '');

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${body.apiKey}`,
      },
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
        temperature: body.temperature ?? (body.mode === 'json' ? 0.3 : 0.7),
        ...(body.mode === 'json' ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const message = data?.error?.message || data?.message || `请求失败: ${upstream.status}`;
      return NextResponse.json({ error: message }, { status: upstream.status });
    }

    return NextResponse.json({
      content: data?.choices?.[0]?.message?.content ?? '',
      raw: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 代理请求失败';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

