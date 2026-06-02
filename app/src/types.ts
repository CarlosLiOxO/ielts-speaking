/** 雅思口语练习 - 核心类型定义 */

// ===== 题库类型 =====
export interface Part1Question {
  question: string;
  answer: string;
}

export interface Part1Topic {
  topic: string;
  questions: Part1Question[];
}

export interface Part23Card {
  titleZh: string;
  part2: {
    prompt: string;
    cueCard: string[];
    sampleAnswer: string;
  } | null;
  part3Questions: { question: string; answer: string }[];
}

export interface QuestionBank {
  part1: {
    必考题: Part1Topic[];
    保留题: Part1Topic[];
    旧题: Part1Topic[];
  };
  part23: {
    保留题: Part23Card[];
    旧题: Part23Card[];
  };
}

// ===== 练习记录类型 =====
export interface PracticeRecord {
  id?: number;
  date: string;             // ISO 日期字符串
  part: 'part1' | 'part2' | 'part3' | 'exam';
  topicOrTitle: string;     // 话题名或 Part2 标题
  question: string;         // 具体问题
  transcript: string;       // 语音转文字结果
  aiFeedback?: string;      // AI 评分反馈
  audioBlob?: Blob;         // 录音文件
  duration: number;         // 录音时长（秒）
  wordCount: number;        // 单词数
  speechRate: number;       // 语速（词/分钟）
  pauseCount: number;       // 停顿次数
  isWeak?: boolean;         // 是否标记为薄弱
}

// ===== 应用设置类型 =====
export interface AppSettings {
  dashscopeApiKey: string;  // 旧字段兼容，Mimo 迁移后不再使用
  glmApiKey: string;        // 旧字段兼容，Mimo 迁移后不再使用
  practiceMode: 'normal' | 'stress' | 'warmup';  // 练习模式
  enableTTS: boolean;       // 是否启用语音播报题目
  enableSTT: boolean;       // 是否启用语音识别
}

// ===== 练习会话类型 =====
export type PracticeMode = 'normal' | 'stress' | 'warmup';
export type ActivePart = 'part1' | 'part2' | 'part3';

export interface ExamSession {
  mode: PracticeMode;
  currentPart: ActivePart;
  part1Topic: Part1Topic | null;
  part1QuestionIndex: number;
  part23Card: Part23Card | null;
  startTime: number;
  records: PracticeRecord[];
}

// ===== 对话消息类型（多轮 AI 考官）=====
export interface ChatMessage {
  role: 'examiner' | 'user';
  content: string;
  timestamp: number;
}

// ===== 语音统计类型 =====
export interface SpeechStats {
  duration: number;      // 秒
  wordCount: number;     // 单词数
  speechRate: number;    // 词/分钟
  pauseCount: number;    // 停顿次数（>0.5s）
  fillerWords: number;   // 填充词（um, uh, like, you know）
}
