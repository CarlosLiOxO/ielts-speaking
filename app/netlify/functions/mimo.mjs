import { randomUUID } from 'node:crypto';

const MIMO_API_BASE_URL = (process.env.MIMO_API_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1').replace(/\/$/, '');
const CHAT_COMPLETIONS_URL = `${MIMO_API_BASE_URL}/chat/completions`;

const MIMO_MODELS = {
  FEEDBACK: 'mimo-v2.5-pro',
  CHAT: 'mimo-v2.5',
  KEYWORDS: 'mimo-v2.5',
  TRANSCRIBE: 'mimo-v2-omni',
  TTS: 'mimo-v2.5-tts',
  TTS_FALLBACK: 'mimo-v2-tts',
};

const MIMO_TIMEOUT_MS = {
  CHAT: Number(process.env.MIMO_CHAT_TIMEOUT_MS || 30000),
  TTS: Number(process.env.MIMO_TTS_TIMEOUT_MS || 45000),
  TRANSCRIBE: Number(process.env.MIMO_TRANSCRIBE_TIMEOUT_MS || 60000),
};

function getMimoApiKey() {
  return process.env.MIMO_API_KEY?.trim();
}

function createHeaders(requestId, contentType = 'application/json; charset=utf-8') {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Request-Id': requestId,
  };
}

function jsonResponse(statusCode, payload, requestId) {
  return {
    statusCode,
    headers: createHeaders(requestId),
    body: JSON.stringify(payload),
  };
}

function audioResponse(audioBase64, contentType, requestId) {
  return {
    statusCode: 200,
    headers: createHeaders(requestId, contentType),
    body: audioBase64,
    isBase64Encoded: true,
  };
}

function logProxyEvent(event) {
  console.log(JSON.stringify({
    service: 'mimo-netlify-function',
    timestamp: new Date().toISOString(),
    ...event,
  }));
}

function safeParseJson(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return null;
  }
}

function parseRequestBody(text) {
  const data = safeParseJson(text);
  if (!data) throw new Error('请求体不是合法 JSON');
  return data;
}

function extractMimoError(data) {
  return data?.error?.message || data?.message || data?.raw || '未知错误';
}

function extractText(data) {
  const message = data?.choices?.[0]?.message;
  return message?.content || message?.reasoning_content || '';
}

function assertMimoConfig() {
  const apiKey = getMimoApiKey();
  if (!apiKey || apiKey === 'your-mimo-api-key') {
    throw new Error('缺少 MIMO_API_KEY，请在 Netlify 环境变量中配置真实的小米 MiMo API Key');
  }
  return apiKey;
}

function createMimoSystemPrompt() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `You are MiMo, an AI assistant developed by Xiaomi. Today's date: ${today}. Your knowledge cutoff date is December 2024.`;
}

async function callMimo(payload, timeoutMs, meta) {
  const apiKey = assertMimoConfig();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    const data = safeParseJson(text) ?? { raw: text };

    if (!response.ok) {
      throw new Error(`Mimo API 错误 (${response.status}): ${extractMimoError(data)}`);
    }

    logProxyEvent({
      level: 'info',
      requestId: meta.requestId,
      route: meta.route,
      model: payload.model,
      status: response.status,
      durationMs: Date.now() - startedAt,
      timeoutMs,
    });

    return data;
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    logProxyEvent({
      level: 'error',
      requestId: meta.requestId,
      route: meta.route,
      model: payload.model,
      durationMs: Date.now() - startedAt,
      timeoutMs,
      error: isTimeout ? 'timeout' : error?.message || 'unknown',
    });

    if (isTimeout) {
      throw new Error(`Mimo 请求超时，请稍后重试（${Math.round(timeoutMs / 1000)} 秒）`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleChat(body, requestId) {
  const data = await callMimo({
    model: body.model || MIMO_MODELS.CHAT,
    messages: body.messages || [],
    max_completion_tokens: body.max_completion_tokens ?? body.max_tokens ?? 1024,
    temperature: body.temperature ?? 1.0,
    top_p: body.top_p ?? 0.95,
    stream: false,
    ...body.options,
  }, MIMO_TIMEOUT_MS.CHAT, { requestId, route: '/api/mimo/chat' });

  return jsonResponse(200, {
    text: extractText(data),
    raw: data,
  }, requestId);
}

async function handleTranscribe(body, requestId) {
  const audioData = body.audioData;

  if (!audioData || typeof audioData !== 'string') {
    return jsonResponse(400, { error: '缺少 audioData' }, requestId);
  }

  const data = await callMimo({
    model: MIMO_MODELS.TRANSCRIBE,
    messages: [
      {
        role: 'system',
        content: createMimoSystemPrompt(),
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: audioData,
            },
          },
          {
            type: 'text',
            text: 'Transcribe this IELTS speaking audio exactly. Return only the spoken words. Do not add explanations, comments, scores, or markdown.',
          },
        ],
      },
    ],
    max_completion_tokens: 2048,
    temperature: 0.1,
    stream: false,
  }, MIMO_TIMEOUT_MS.TRANSCRIBE, { requestId, route: '/api/mimo/transcribe' });

  return jsonResponse(200, {
    transcript: extractText(data).trim(),
    raw: data,
  }, requestId);
}

async function handleTTS(body, requestId) {
  const text = String(body.text || '').trim();

  if (!text) {
    return jsonResponse(400, { error: '缺少 text' }, requestId);
  }

  const voice = body.voice || 'Chloe';
  const style = body.style || 'Professional IELTS examiner voice. Clear British English, calm, patient, and slightly slow speaking pace.';
  const model = body.model || MIMO_MODELS.TTS;
  const audioFormat = body.format || 'wav';

  const data = await callMimo({
    model,
    messages: [
      {
        role: 'user',
        content: style,
      },
      {
        role: 'assistant',
        content: text,
      },
    ],
    audio: {
      format: audioFormat,
      voice,
    },
    stream: false,
  }, MIMO_TIMEOUT_MS.TTS, { requestId, route: '/api/mimo/tts' });

  const audioBase64 = data?.choices?.[0]?.message?.audio?.data;
  if (!audioBase64) {
    return jsonResponse(502, { error: 'Mimo TTS 未返回音频数据', raw: data }, requestId);
  }

  return audioResponse(audioBase64, audioFormat === 'wav' ? 'audio/wav' : 'application/octet-stream', requestId);
}

function handleHealth(requestId) {
  const apiKey = getMimoApiKey();
  return jsonResponse(200, {
    ok: true,
    service: 'mimo-netlify-function',
    baseUrl: MIMO_API_BASE_URL,
    configured: Boolean(apiKey && apiKey !== 'your-mimo-api-key'),
    models: MIMO_MODELS,
    timeouts: MIMO_TIMEOUT_MS,
  }, requestId);
}

function getAction(event) {
  const path = event.path || '';
  if (path.endsWith('/health')) return 'health';
  if (path.endsWith('/chat')) return 'chat';
  if (path.endsWith('/transcribe')) return 'transcribe';
  if (path.endsWith('/tts')) return 'tts';
  return '';
}

export async function handler(event) {
  const requestId = event.headers['x-request-id'] || event.headers['X-Request-Id'] || randomUUID();
  const action = getAction(event);

  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: createHeaders(requestId), body: '' };
    }

    if (event.httpMethod === 'GET' && action === 'health') {
      return handleHealth(requestId);
    }

    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed' }, requestId);
    }

    const body = parseRequestBody(event.body || '{}');

    if (action === 'chat') return handleChat(body, requestId);
    if (action === 'transcribe') return handleTranscribe(body, requestId);
    if (action === 'tts') return handleTTS(body, requestId);

    return jsonResponse(404, { error: 'Not found' }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = message.includes('MIMO_API_KEY') ? 401 : 500;
    return jsonResponse(statusCode, { error: message }, requestId);
  }
}
