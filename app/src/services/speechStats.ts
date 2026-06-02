/**
 * 语音统计分析服务
 * 分析语速、停顿、填充词等发音指标
 */

import type { SpeechStats } from '../types';

// 常见填充词列表
const FILLER_WORDS = [
  'um', 'uh', 'er', 'ah', 'like', 'you know', 'kind of', 'sort of',
  'basically', 'literally', 'actually', 'honestly', 'right', 'okay so'
];

/**
 * 分析语音转文字结果，生成统计数据
 * @param transcript 转写文本
 * @param duration 录音时长（秒）
 * @param timestamps 单词时间戳（可选，用于精确停顿统计）
 */
export function analyzeSpeech(
  transcript: string,
  duration: number,
  pauseData?: number[]  // 停顿时长数组（秒）
): SpeechStats {
  // 单词数统计
  const words = transcript.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // 语速（词/分钟）
  const speechRate = duration > 0 ? Math.round((wordCount / duration) * 60) : 0;

  // 停顿次数（大于 0.5 秒）
  const pauseCount = pauseData
    ? pauseData.filter(p => p > 0.5).length
    : estimatePauseCount(transcript, duration);

  // 填充词统计
  const lowerText = transcript.toLowerCase();
  let fillerWords = 0;
  for (const filler of FILLER_WORDS) {
    const regex = new RegExp(`\\b${filler}\\b`, 'g');
    const matches = lowerText.match(regex);
    if (matches) fillerWords += matches.length;
  }

  return {
    duration,
    wordCount,
    speechRate,
    pauseCount,
    fillerWords,
  };
}

/**
 * 根据文本估算停顿次数（当没有精确时间戳时）
 * 通过逗号、句号等标点符号估算
 */
function estimatePauseCount(transcript: string, duration: number): number {
  // 统计标点符号数量作为停顿估计
  const punctuationPauses = (transcript.match(/[,;.!?]/g) || []).length;
  // 根据时长也粗估一下（平均每10秒有一次额外停顿）
  const timeBasedPauses = Math.floor(duration / 10);
  return Math.min(punctuationPauses + timeBasedPauses, 20);
}

/**
 * 生成语速评价
 */
export function getSpeechRateEvaluation(speechRate: number): {
  level: 'slow' | 'good' | 'fast';
  label: string;
  color: string;
} {
  // 雅思口语理想语速约 100-140 词/分钟
  if (speechRate < 80) {
    return { level: 'slow', label: '偏慢', color: 'text-yellow-500' };
  } else if (speechRate <= 150) {
    return { level: 'good', label: '适中', color: 'text-green-500' };
  } else {
    return { level: 'fast', label: '偏快', color: 'text-orange-500' };
  }
}

/**
 * 生成停顿评价
 */
export function getPauseEvaluation(pauseCount: number, duration: number): {
  level: 'few' | 'good' | 'many';
  label: string;
  color: string;
} {
  // 每分钟停顿次数
  const pausesPerMinute = duration > 0 ? (pauseCount / duration) * 60 : 0;
  if (pausesPerMinute < 2) {
    return { level: 'few', label: '流畅', color: 'text-green-500' };
  } else if (pausesPerMinute <= 5) {
    return { level: 'good', label: '正常', color: 'text-green-500' };
  } else {
    return { level: 'many', label: '停顿偏多', color: 'text-yellow-500' };
  }
}
