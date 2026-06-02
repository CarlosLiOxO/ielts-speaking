/**
 * AI 服务
 * - Mimo：口语表现评分、关键词提示、多轮对话模拟考官
 */

import type { ChatMessage } from '../types';

const MIMO_CHAT_API_URL = '/api/mimo/chat';
const MIMO_FEEDBACK_MODEL = 'mimo-v2.5-pro';
const MIMO_CHAT_MODEL = 'mimo-v2.5';
const MIMO_KEYWORD_MODEL = 'mimo-v2.5';

interface MimoChatPayload {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
}

interface MimoChatResponse {
  text?: string;
  error?: string;
}

/** 调用本地 Mimo 代理并返回文本结果 */
async function callMimoChat(payload: MimoChatPayload): Promise<string> {
  const response = await fetch(MIMO_CHAT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json() as MimoChatResponse;

  if (!response.ok) {
    if (response.status === 401) throw new Error('Mimo API Key 无效，请检查服务端环境变量 MIMO_API_KEY');
    if (response.status === 429) throw new Error('Mimo 请求过于频繁，请稍后重试');
    throw new Error(data.error || `Mimo API 错误 (${response.status})`);
  }

  return data.text || '';
}

/**
 * 调用 Mimo 对口语答案进行评分
 * 按雅思四个维度评价：流利度、词汇、语法、发音/任务回应
 */
export async function getAIFeedback(
  _apiKey: string,
  question: string,
  answer: string,
  part: 'part1' | 'part2' | 'part3'
): Promise<string> {
  const partDesc = {
    part1: 'Part 1（日常话题问答，每题约 20-30 秒）',
    part2: 'Part 2（独白，约 1.5-2 分钟）',
    part3: 'Part 3（深度讨论，每题约 40-60 秒）',
  }[part];

  const prompt = `你是一位雅思口语考官，请对以下雅思 ${partDesc} 答案进行评估。

题目：${question}

考生答案（语音转文字）：
${answer}

请按以下格式给出简洁反馈（中文回复，总字数不超过 300 字）：

**预估分数**：X.0 - X.5 分

**流利度与连贯性**：（1-2句）
**词汇资源**：（1-2句）
**语法范围与准确性**：（1-2句）
**发音与表达自然度**：（1-2句，基于转写文本谨慎判断）

**亮点**：（1个）
**改进建议**：（1-2个具体建议）`;

  return callMimoChat({
    model: MIMO_FEEDBACK_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    top_p: 0.95,
    max_completion_tokens: 700,
  });
}

/**
 * 启动 AI 考官对话（Mimo）
 * @param _apiKey 保留兼容旧调用，实际 API Key 由服务端环境变量提供
 * @param history 历史消息
 * @param userMessage 用户最新消息
 * @param context 当前考试上下文（话题、Part 类型）
 */
export async function chatWithExaminer(
  _apiKey: string,
  history: ChatMessage[],
  userMessage: string,
  context: { topic: string; part: 'part1' | 'part3' }
): Promise<string> {
  const systemPrompt = `你是一位专业的雅思口语考官，正在进行 ${context.part === 'part1' ? 'Part 1' : 'Part 3'} 考试。
当前话题：${context.topic}

规则：
1. 用英文提问，语气专业、友好
2. Part 1：问日常生活相关的简短问题
3. Part 3：根据话题进行深度追问，如"Why do you think...?", "How has this changed...?"
4. 根据考生的回答进行自然的追问（follow-up）
5. 每次只提一个问题
6. 如果考生回答离题，温和地引导回来
7. 不要给中文解释，不要评分，只扮演考官

现在开始考试。`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map(m => ({
      role: (m.role === 'examiner' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const text = await callMimoChat({
    model: MIMO_CHAT_MODEL,
    messages,
    temperature: 0.8,
    top_p: 0.95,
    max_completion_tokens: 300,
  });

  return text || 'Could you tell me a little more about that?';
}

/** 让 AI 考官提出第一个问题（开始对话） */
export async function startExaminerChat(
  apiKey: string,
  context: { topic: string; part: 'part1' | 'part3' }
): Promise<string> {
  return chatWithExaminer(apiKey, [], 'Please start the exam.', context);
}

/** 为 Part 2 题目生成关键词提示（使用 Mimo） */
export async function generateKeywordHints(
  _apiKey: string,
  topic: string,
  prompt: string
): Promise<string[]> {
  const message = `为以下雅思 Part 2 题目生成 5 个关键词/短语提示，帮助考生组织答案。
只输出关键词，每行一个，不要编号或解释。

题目：${prompt}
话题：${topic}`;

  const content = await callMimoChat({
    model: MIMO_KEYWORD_MODEL,
    messages: [{ role: 'user', content: message }],
    temperature: 0.5,
    top_p: 0.9,
    max_completion_tokens: 120,
  });

  return content.split('\n').filter((s: string) => s.trim()).slice(0, 5);
}
