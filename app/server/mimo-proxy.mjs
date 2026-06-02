import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';

/** 加载本地 .env 文件，避免额外引入 dotenv 依赖。 */
function loadEnvFile() {
  const envPath = new URL('../.env', import.meta.url);
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const PORT = Number(process.env.MIMO_PROXY_PORT || 8787);
const MIMO_API_KEY = process.env.MIMO_API_KEY?.trim();
const MIMO_API_BASE_URL = (process.env.MIMO_API_BASE_URL || 'https://api.xiaomimimo.com/v1').replace(/\/$/, '');
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

/** 输出不含敏感内容的代理请求日志。 */
function logProxyEvent(event) {
  console.log(JSON.stringify({
    service: 'mimo-proxy',
    timestamp: new Date().toISOString(),
    ...event,
  }));
}

/** 读取 HTTP 请求体并按大小限制保护代理。 */
function readJsonBody(request, limitBytes = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error('请求体过大'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });

    request.on('error', reject);
  });
}

/** 统一写 JSON 响应。 */
function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

/** 统一写二进制音频响应。 */
function sendAudio(response, audioBuffer, contentType) {
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': audioBuffer.length,
    'Cache-Control': 'no-store',
  });
  response.end(audioBuffer);
}

/** 检查 Mimo API Key 是否已通过环境变量配置。 */
function assertMimoConfig() {
  if (!MIMO_API_KEY || MIMO_API_KEY === 'your-mimo-api-key') {
    throw new Error('缺少 MIMO_API_KEY，请在 app/.env 中配置真实的小米 MiMo API Key');
  }
}

/** 调用 Mimo OpenAI 兼容 chat completions 接口。 */
async function callMimo(payload, timeoutMs = MIMO_TIMEOUT_MS.CHAT, meta = {}) {
  assertMimoConfig();

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': MIMO_API_KEY,
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

/** 安全解析 JSON 字符串，解析失败时返回 null。 */
function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 从 Mimo 错误响应中提取可读错误信息。 */
function extractMimoError(data) {
  return data?.error?.message || data?.message || data?.raw || '未知错误';
}

/** 从 Mimo 文本响应中提取最终内容，兼容 reasoning_content。 */
function extractText(data) {
  const message = data?.choices?.[0]?.message;
  return message?.content || message?.reasoning_content || '';
}

/** 构造 MiMo 系统提示词。 */
function createMimoSystemPrompt() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `You are MiMo, an AI assistant developed by Xiaomi. Today's date: ${today}. Your knowledge cutoff date is December 2024.`;
}

/** 处理通用文本聊天请求。 */
async function handleChat(request, response, requestId) {
  const body = await readJsonBody(request);
  const data = await callMimo({
    model: body.model || MIMO_MODELS.CHAT,
    messages: body.messages || [],
    max_completion_tokens: body.max_completion_tokens ?? body.max_tokens ?? 1024,
    temperature: body.temperature ?? 1.0,
    top_p: body.top_p ?? 0.95,
    stream: false,
    ...body.options,
  }, MIMO_TIMEOUT_MS.CHAT, { requestId, route: '/api/mimo/chat' });

  sendJson(response, 200, {
    text: extractText(data),
    raw: data,
  });
}

/** 处理录音后音频转写请求。 */
async function handleTranscribe(request, response, requestId) {
  const body = await readJsonBody(request, 80 * 1024 * 1024);
  const audioData = body.audioData;

  if (!audioData || typeof audioData !== 'string') {
    sendJson(response, 400, { error: '缺少 audioData' });
    return;
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

  sendJson(response, 200, {
    transcript: extractText(data).trim(),
    raw: data,
  });
}

/** 处理 Mimo TTS 语音合成请求。 */
async function handleTTS(request, response, requestId) {
  const body = await readJsonBody(request);
  const text = String(body.text || '').trim();

  if (!text) {
    sendJson(response, 400, { error: '缺少 text' });
    return;
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
    sendJson(response, 502, { error: 'Mimo TTS 未返回音频数据', raw: data });
    return;
  }

  sendAudio(response, Buffer.from(audioBase64, 'base64'), audioFormat === 'wav' ? 'audio/wav' : 'application/octet-stream');
}

/** 按路由分发 Mimo 代理请求。 */
async function routeRequest(request, response) {
  const requestId = request.headers['x-request-id'] || randomUUID();
  response.setHeader('X-Request-Id', requestId);

  if (request.method === 'GET' && (request.url === '/health' || request.url === '/api/mimo/health')) {
    sendJson(response, 200, {
      ok: true,
      service: 'mimo-proxy',
      baseUrl: MIMO_API_BASE_URL,
      configured: Boolean(MIMO_API_KEY && MIMO_API_KEY !== 'your-mimo-api-key'),
      models: MIMO_MODELS,
      timeouts: MIMO_TIMEOUT_MS,
    });
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  if (request.url === '/api/mimo/chat') {
    await handleChat(request, response, requestId);
    return;
  }

  if (request.url === '/api/mimo/transcribe') {
    await handleTranscribe(request, response, requestId);
    return;
  }

  if (request.url === '/api/mimo/tts') {
    await handleTTS(request, response, requestId);
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
}

const server = createServer((request, response) => {
  routeRequest(request, response).catch((error) => {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Mimo proxy 启动失败：127.0.0.1:${PORT} 已被占用，请先停止旧的 npm run dev 进程或修改 MIMO_PROXY_PORT。`);
    process.exit(1);
  }

  console.error('Mimo proxy 启动失败：', error);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mimo proxy listening on http://127.0.0.1:${PORT}`);
  console.log(`Mimo chat endpoint: http://127.0.0.1:${PORT}/api/mimo/chat`);
  console.log(`Mimo transcribe endpoint: http://127.0.0.1:${PORT}/api/mimo/transcribe`);
  console.log(`Mimo tts endpoint: http://127.0.0.1:${PORT}/api/mimo/tts`);
});
