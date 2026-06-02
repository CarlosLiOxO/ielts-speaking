/**
 * 完整模拟考试页面
 * 按真实雅思顺序：Part 1 (4-5题) → Part 2 (1分钟准备+独白) → Part 3 (4-5题)
 */
import { useState } from 'react';
import { Play, CheckCircle } from 'lucide-react';
import questionsData from '../data/questions.json';
import { useAppStore } from '../stores/useAppStore';
import { RecorderPanel } from '../components/RecorderPanel';
import { Timer } from '../components/Timer';
import { saveRecord } from '../services/db';
import { preloadSpeech as preloadMimoSpeech, retryLastSpeech, speak as speakMimo } from '../services/tts';
import { useTTSStatus } from '../hooks/useTTSStatus';
import { AIRequestStatus } from '../components/AIRequestStatus';
import { PageContent, PageHeader, PageShell } from '../components/ui';
import type { Part23Card, SpeechStats } from '../types';

const TTS_SOURCE = 'exam';

type ExamStep =
  | 'intro'
  | 'part1-question'
  | 'part2-prep'
  | 'part2-speaking'
  | 'part3-question'
  | 'complete';

const allPart1Topics = [
  ...questionsData.part1.必考题,
  ...questionsData.part1.保留题,
];
// 类型谓词过滤，让 TypeScript 知道结果中 part2 必然非空
const allPart23Cards = questionsData.part23.保留题.filter(
  (c): c is Part23Card & { part2: NonNullable<Part23Card['part2']> } => c.part2 !== null
);

/** Fisher-Yates 洗牌算法，返回新数组 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 随机选题构建考试套卷 */
function buildExam() {
  // 随机选 2 个 Part 1 话题，各取 2-3 题
  const shuffledTopics = shuffle(allPart1Topics);
  const part1Questions: { topic: string; question: string; answer: string }[] = [];
  for (const topic of shuffledTopics.slice(0, 2)) {
    const qs = topic.questions.slice(0, 3);
    qs.forEach(q => part1Questions.push({ topic: topic.topic, ...q }));
  }

  // 随机选 1 张 Part 2&3 卡片（类型谓词已确保 part2 非空，无需强制转换）
  const card = allPart23Cards[Math.floor(Math.random() * allPart23Cards.length)];

  // Part 3 取 4 题
  const part3Questions = card.part3Questions.slice(0, 4);

  return { part1Questions, card, part3Questions };
}

export function ExamPage() {
  const { setPage, settings } = useAppStore();
  const ttsStatus = useTTSStatus(TTS_SOURCE);
  const [step, setStep] = useState<ExamStep>('intro');
  const [exam] = useState(buildExam);
  const [part1Index, setPart1Index] = useState(0);
  const [part3Index, setPart3Index] = useState(0);
  const [prepRunning, setPrepRunning] = useState(false);
  const [completedParts, setCompletedParts] = useState<string[]>([]);

  const isStressMode = settings.practiceMode === 'stress';
  const isWarmupMode = settings.practiceMode === 'warmup';

  const currentPart1Q = exam.part1Questions[part1Index];
  const currentPart3Q = exam.part3Questions[part3Index];

  /** 预加载题目音频 */
  const preloadQuestion = (text: string | undefined) => {
    if (settings.enableTTS && text) preloadMimoSpeech(text, { source: TTS_SOURCE });
  };

  /** 播报当前题目 */
  const speakQuestion = (text: string) => {
    if (settings.enableTTS) {
      preloadMimoSpeech(text, { source: TTS_SOURCE });
      speakMimo(text, { source: TTS_SOURCE });
    }
  };

  const handlePart1Complete = async (data: {
    transcript: string;
    audioBlob: Blob | null;
    stats: SpeechStats | null;
    duration: number;
  }) => {
    await saveRecord({
      date: new Date().toISOString(),
      part: 'part1',
      topicOrTitle: currentPart1Q.topic,
      question: currentPart1Q.question,
      transcript: data.transcript,
      audioBlob: data.audioBlob || undefined,
      duration: data.duration,
      wordCount: data.stats?.wordCount || 0,
      speechRate: data.stats?.speechRate || 0,
      pauseCount: data.stats?.pauseCount || 0,
    });

    const next = part1Index + 1;
    if (next < exam.part1Questions.length) {
      setPart1Index(next);
      preloadQuestion(exam.part1Questions[next + 1]?.question);
      setTimeout(() => speakQuestion(exam.part1Questions[next].question), 500);
    } else {
      setCompletedParts(p => [...p, 'part1']);
      setStep('part2-prep');
      setPrepRunning(true);
      if (exam.card.part2) {
        preloadQuestion(exam.part3Questions[0]?.question);
        speakQuestion(exam.card.part2.prompt);
      }
    }
  };

  const handlePart2Complete = async (data: {
    transcript: string;
    audioBlob: Blob | null;
    stats: SpeechStats | null;
    duration: number;
  }) => {
    if (exam.card.part2) {
      await saveRecord({
        date: new Date().toISOString(),
        part: 'part2',
        topicOrTitle: exam.card.titleZh,
        question: exam.card.part2.prompt,
        transcript: data.transcript,
        audioBlob: data.audioBlob || undefined,
        duration: data.duration,
        wordCount: data.stats?.wordCount || 0,
        speechRate: data.stats?.speechRate || 0,
        pauseCount: data.stats?.pauseCount || 0,
      });
    }

    setCompletedParts(p => [...p, 'part2']);
    setStep('part3-question');
    preloadQuestion(exam.part3Questions[1]?.question);
    if (exam.part3Questions.length > 0) speakQuestion(exam.part3Questions[0].question);
  };

  const handlePart3Complete = async (data: {
    transcript: string;
    audioBlob: Blob | null;
    stats: SpeechStats | null;
    duration: number;
  }) => {
    await saveRecord({
      date: new Date().toISOString(),
      part: 'part3',
      topicOrTitle: exam.card.titleZh,
      question: currentPart3Q?.question || '',
      transcript: data.transcript,
      audioBlob: data.audioBlob || undefined,
      duration: data.duration,
      wordCount: data.stats?.wordCount || 0,
      speechRate: data.stats?.speechRate || 0,
      pauseCount: data.stats?.pauseCount || 0,
    });

    const next = part3Index + 1;
    if (next < exam.part3Questions.length) {
      setPart3Index(next);
      preloadQuestion(exam.part3Questions[next + 1]?.question);
      setTimeout(() => speakQuestion(exam.part3Questions[next].question), 500);
    } else {
      setCompletedParts(p => [...p, 'part3']);
      setStep('complete');
    }
  };

  const modeLabel = isStressMode ? '压力模式' : isWarmupMode ? '热身模式' : '标准模式';
  const modeColor = isStressMode ? 'text-red-600 bg-red-50' : isWarmupMode ? 'text-green-600 bg-green-50' : 'text-blue-600 bg-blue-50';

  return (
    <PageShell>
      <PageHeader
        title="模拟考试"
        subtitle="完整流程与真实考试节奏"
        backLabel="返回首页"
        onBack={() => setPage('home')}
        actions={<span className={`text-xs font-medium px-3 py-1 rounded-full ${modeColor}`}>{modeLabel}</span>}
      />

      {/* 进度条 */}
      <div className="flex bg-gray-100 dark:bg-gray-700">
        {['Part 1', 'Part 2', 'Part 3'].map((part, i) => {
          const key = `part${i + 1}`;
          const isDone = completedParts.includes(key);
          const isActive = step.startsWith(`part${i + 1}`) || (step === 'part2-prep' && i === 1);
          return (
            <div key={part} className={`flex-1 py-2 text-center text-xs font-medium transition-colors ${
              isDone ? 'bg-green-100 text-green-600' :
              isActive ? 'bg-blue-100 text-blue-600' :
              'text-gray-400'
            }`}>
              {isDone ? <CheckCircle size={12} className="inline mr-1" /> : null}
              {part}
            </div>
          );
        })}
      </div>

      <PageContent className="space-y-4">
        {ttsStatus.status === 'loading' && <AIRequestStatus type="loading" message={ttsStatus.message} />}
        {ttsStatus.status === 'playing' && <AIRequestStatus type="speaking" message={ttsStatus.message} />}
        {ttsStatus.status === 'error' && <AIRequestStatus type="error" message={ttsStatus.message} actionLabel="重试" onAction={retryLastSpeech} />}

        {/* ===== 开始介绍 ===== */}
        {step === 'intro' && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">雅思口语模拟考试</h2>
            <p className="text-gray-500 mb-2">本次考试将包含：</p>
            <div className="inline-flex flex-col gap-2 text-left mb-8">
              <p className="text-sm text-gray-600 dark:text-gray-300">📝 Part 1：{exam.part1Questions.length} 道日常问题</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">🎤 Part 2：独白（1分钟准备 + 约2分钟作答）</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">💬 Part 3：{exam.part3Questions.length} 道深度追问</p>
            </div>
            <p className="text-sm text-gray-400 mb-8">话题：{exam.card.titleZh}</p>
            <button
              onClick={() => {
                setStep('part1-question');
                preloadQuestion(exam.part1Questions[1]?.question);
                speakQuestion(exam.part1Questions[0].question);
              }}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg mx-auto transition-colors"
            >
              <Play size={22} />
              开始考试
            </button>
          </div>
        )}

        {/* ===== Part 1 答题 ===== */}
        {step === 'part1-question' && currentPart1Q && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs font-semibold">Part 1</span>
              <span>{part1Index + 1} / {exam.part1Questions.length}</span>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-400 mb-2">{currentPart1Q.topic}</p>
              <p className="text-xl font-medium text-gray-800 dark:text-white leading-relaxed">
                {currentPart1Q.question}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <RecorderPanel
                onComplete={handlePart1Complete}
                timeLimit={isStressMode ? 40 : 0}
              />
            </div>
          </div>
        )}

        {/* ===== Part 2 准备 ===== */}
        {step === 'part2-prep' && exam.card.part2 && (
          <div className="flex flex-col gap-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-amber-800 dark:text-amber-200">准备时间（1分钟）</span>
                <Timer
                  mode="countdown"
                  initialSeconds={isWarmupMode ? 90 : 60}
                  running={prepRunning}
                  onTimeUp={() => { setPrepRunning(false); setStep('part2-speaking'); }}
                  className="text-3xl text-amber-700"
                />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
                <p className="font-medium text-gray-800 dark:text-white mb-3">{exam.card.part2.prompt}</p>
                <ul className="space-y-1">
                  {exam.card.part2.cueCard.map((point, i) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-gray-300">• {point}</li>
                  ))}
                </ul>
              </div>
            </div>
            <button
              onClick={() => { setPrepRunning(false); setStep('part2-speaking'); }}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium"
            >
              准备好了
            </button>
          </div>
        )}

        {/* ===== Part 2 作答 ===== */}
        {step === 'part2-speaking' && exam.card.part2 && (
          <div className="flex flex-col gap-4">
            <div className="bg-blue-100 text-blue-600 rounded-full px-3 py-1 text-xs font-semibold w-fit">Part 2</div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="font-medium text-gray-800 dark:text-white">{exam.card.part2.prompt}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <RecorderPanel
                onComplete={handlePart2Complete}
                timeLimit={isStressMode ? 120 : 0}
              />
            </div>
          </div>
        )}

        {/* ===== Part 3 作答 ===== */}
        {step === 'part3-question' && currentPart3Q && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm">
              <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-xs font-semibold">Part 3</span>
              <span className="text-gray-500">{part3Index + 1} / {exam.part3Questions.length}</span>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <p className="text-xl font-medium text-gray-800 dark:text-white leading-relaxed">
                {currentPart3Q.question}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <RecorderPanel
                onComplete={handlePart3Complete}
                timeLimit={isStressMode ? 60 : 0}
              />
            </div>
          </div>
        )}

        {/* ===== 考试完成 ===== */}
        {step === 'complete' && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">考试完成！</h2>
            <p className="text-gray-500 mb-8">所有答题记录已保存，去历史记录查看详情</p>
            <div className="flex gap-3 max-w-xs mx-auto">
              <button onClick={() => setPage('history')}
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium">
                查看记录
              </button>
              <button onClick={() => setPage('home')}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium">
                返回首页
              </button>
            </div>
          </div>
        )}
      </PageContent>
    </PageShell>
  );
}
