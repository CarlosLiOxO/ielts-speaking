/**
 * Part 1 练习页面
 * 支持随机抽题、话题选择、多种练习模式
 */
import { useState, useCallback } from 'react';
import { Shuffle, Volume2, BookOpen, Flag, ChevronRight, ChevronLeft } from 'lucide-react';
import questionsData from '../data/questions.json';
import { useAppStore } from '../stores/useAppStore';
import { RecorderPanel } from '../components/RecorderPanel';
import { AIFeedbackPanel, type FeedbackStatus } from '../components/AIFeedbackPanel';
import { AppButton, IconButton, PageContent, PageHeader, PageShell, PromptCard, SegmentedFilter } from '../components/ui';
import { saveRecord, updateRecordFeedback } from '../services/db';
import { preloadSpeechQueue, retryLastSpeech, speak } from '../services/tts';
import { useTTSStatus } from '../hooks/useTTSStatus';
import { AIRequestStatus } from '../components/AIRequestStatus';
import type { Part1Topic, SpeechStats } from '../types';

// 合并所有 Part 1 话题
const TTS_SOURCE = 'practice-part1';

const allTopics: (Part1Topic & { category: string })[] = [
  ...questionsData.part1.必考题.map(t => ({ ...t, category: '必考题' })),
  ...questionsData.part1.保留题.map(t => ({ ...t, category: '保留题' })),
  ...questionsData.part1.旧题.map(t => ({ ...t, category: '旧题' })),
];

type PracticeStep = 'select' | 'question' | 'result';

interface QuestionState {
  topic: Part1Topic & { category: string };
  questionIndex: number;
  transcript: string;
  audioBlob: Blob | null;
  stats: SpeechStats | null;
  aiFeedback: string;
  recordId?: number;
}

export function PracticePart1Page() {
  const { setPage, settings, dailyIndex } = useAppStore();
  const ttsStatus = useTTSStatus(TTS_SOURCE);
  const [step, setStep] = useState<PracticeStep>('select');
  const [selectedTopic, setSelectedTopic] = useState<(Part1Topic & { category: string }) | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [practiceState, setPracticeState] = useState<QuestionState | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>('idle');
  const [filter, setFilter] = useState<'all' | '必考题' | '保留题' | '旧题'>('all');
  const [weakTopics, setWeakTopics] = useState<Set<string>>(new Set());

  const filteredTopics = filter === 'all'
    ? allTopics
    : allTopics.filter(t => t.category === filter);

  /** 开始练习指定话题和问题（需在 pickRandom/pickDaily 前声明） */
  const startPractice = useCallback((topic: Part1Topic & { category: string }, qIdx: number) => {
    setSelectedTopic(topic);
    setQuestionIndex(qIdx);
    setPracticeState(null);
    setFeedbackStatus('idle');
    setStep('question');

    const questionText = topic.questions[qIdx].question;
    if (settings.enableTTS) {
      preloadSpeechQueue([
        questionText,
        topic.questions[(qIdx + 1) % topic.questions.length]?.question,
        topic.questions[(qIdx + 2) % topic.questions.length]?.question,
      ], { source: TTS_SOURCE });
      speak(questionText, { source: TTS_SOURCE });
    }
  }, [settings.enableTTS]);

  /** 随机选题 */
  const pickRandom = useCallback(() => {
    const topic = filteredTopics[Math.floor(Math.random() * filteredTopics.length)];
    const qIdx = Math.floor(Math.random() * topic.questions.length);
    startPractice(topic, qIdx);
  }, [filteredTopics, startPractice]);

  /** 每日一题 */
  const pickDaily = useCallback(() => {
    const topic = allTopics[dailyIndex % allTopics.length];
    startPractice(topic, 0);
  }, [dailyIndex, startPractice]);

  /** 录音完成 */
  const handleRecordComplete = async (data: {
    transcript: string;
    audioBlob: Blob | null;
    stats: SpeechStats | null;
    duration: number;
  }) => {
    if (!selectedTopic) return;

    const question = selectedTopic.questions[questionIndex];
    const state: QuestionState = {
      topic: selectedTopic,
      questionIndex,
      transcript: data.transcript,
      audioBlob: data.audioBlob,
      stats: data.stats,
      aiFeedback: '',
    };
    // 保存到历史记录
    const recordId = await saveRecord({
      date: new Date().toISOString(),
      part: 'part1',
      topicOrTitle: selectedTopic.topic,
      question: question.question,
      transcript: data.transcript,
      audioBlob: data.audioBlob || undefined,
      duration: data.duration,
      wordCount: data.stats?.wordCount || 0,
      speechRate: data.stats?.speechRate || 0,
      pauseCount: data.stats?.pauseCount || 0,
    });

    setPracticeState({ ...state, recordId });
    setFeedbackStatus('idle');
    setStep('result');
  };

  /** 切换到下一题 */
  const goNextQuestion = () => {
    if (!selectedTopic) return;
    const nextIdx = (questionIndex + 1) % selectedTopic.questions.length;
    startPractice(selectedTopic, nextIdx);
  };

  const currentQuestion = selectedTopic?.questions[questionIndex];
  const canAdvance = Boolean(practiceState?.transcript && feedbackStatus === 'success');
  const advanceHint = !practiceState?.transcript
    ? '请先完成录音'
    : feedbackStatus === 'loading'
      ? 'AI 评分生成中…'
      : feedbackStatus === 'error'
        ? '评分失败，请重新评分'
        : feedbackStatus !== 'success'
          ? '请先获取 AI 评分'
          : '';

  return (
    <PageShell>
      <PageHeader
        title="Part 1 练习"
        subtitle={step === 'select' ? '选择话题，进行短答训练' : selectedTopic?.topic}
        backLabel={step === 'select' ? '返回首页' : '返回话题选择'}
        onBack={() => step === 'select' ? setPage('home') : setStep('select')}
        actions={
          <>
            <AppButton onClick={pickRandom} variant="secondary" size="sm">
              <Shuffle size={14} aria-hidden="true" />
              随机
            </AppButton>
            <AppButton onClick={pickDaily} variant="secondary" size="sm">
              每日一题
            </AppButton>
          </>
        }
      />

      <PageContent>
        {/* ===== 话题选择 ===== */}
        {step === 'select' && (
          <div>
            <div className="mb-4">
              <SegmentedFilter
                label="Part 1 题目分类"
                value={filter}
                onChange={(next) => setFilter(next as typeof filter)}
                options={[
                  { value: 'all', label: '全部' },
                  { value: '必考题', label: '必考题' },
                  { value: '保留题', label: '保留题' },
                  { value: '旧题', label: '旧题' },
                ]}
              />
            </div>

            {/* 话题列表 */}
            <div className="grid gap-2">
              {filteredTopics.map((topic, i) => (
                <button
                  key={i}
                  onClick={() => startPractice(topic, 0)}
                  className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white text-sm">{topic.topic}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {topic.questions.length} 题 · {topic.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {weakTopics.has(topic.topic) && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">薄弱</span>
                    )}
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===== 答题界面 ===== */}
        {step === 'question' && selectedTopic && currentQuestion && (
          <div className="flex flex-col gap-4 pb-24 sm:pb-4">
            {ttsStatus.status === 'loading' && <AIRequestStatus type="loading" message={ttsStatus.message} />}
            {ttsStatus.status === 'playing' && <AIRequestStatus type="speaking" message={ttsStatus.message} />}
            {ttsStatus.status === 'error' && <AIRequestStatus type="error" message={ttsStatus.message} actionLabel="重试" onAction={retryLastSpeech} />}
            {/* 话题信息 */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {selectedTopic.topic} · {questionIndex + 1}/{selectedTopic.questions.length}
              </span>
              <div className="flex gap-2">
                <IconButton
                  label="上一题需先完成当前题录音和评分"
                  disabled
                  onClick={() => questionIndex > 0 && startPractice(selectedTopic, questionIndex - 1)}
                  icon={<ChevronLeft size={16} aria-hidden="true" />}
                />
                <IconButton
                  label="下一题需先完成当前题录音和评分"
                  disabled
                  onClick={() => startPractice(selectedTopic, (questionIndex + 1) % selectedTopic.questions.length)}
                  icon={<ChevronRight size={16} aria-hidden="true" />}
                />
              </div>
            </div>

            <PromptCard
              eyebrow="Question"
              action={
                <IconButton
                  label="播放题目"
                  onClick={() => speak(currentQuestion.question, { source: TTS_SOURCE })}
                  icon={<Volume2 size={18} aria-hidden="true" />}
                />
              }
            >
              <p className="text-lg font-semibold leading-relaxed text-slate-900 dark:text-white">{currentQuestion.question}</p>
            </PromptCard>

            {/* 录音面板 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <RecorderPanel
                onComplete={handleRecordComplete}
                timeLimit={settings.practiceMode === 'stress' ? 40 : 0}
              />
            </div>
          </div>
        )}

        {/* ===== 结果界面 ===== */}
        {step === 'result' && practiceState && currentQuestion && (
          <div className="flex flex-col gap-4">
            {/* 问题回顾 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 mb-2">题目</p>
              <p className="font-medium text-gray-800 dark:text-white">{currentQuestion.question}</p>
            </div>

            {/* 你的回答 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 mb-2">我的回答转写</p>
              <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
                {practiceState.transcript || '未识别到有效转写文本，请重新录音后再评分。'}
              </p>
            </div>

            {/* AI 评分 */}
            <AIFeedbackPanel
              question={currentQuestion.question}
              transcript={practiceState.transcript}
              part="part1"
              autoRequest
              onStatusChange={setFeedbackStatus}
              onFeedbackReceived={(fb) => {
                setPracticeState(prev => prev ? { ...prev, aiFeedback: fb } : prev);
                if (practiceState.recordId) void updateRecordFeedback(practiceState.recordId, fb);
              }}
            />

            {/* 参考答案 */}
            <ReferenceAnswer answer={currentQuestion.answer} />

            {/* 操作按钮 */}
            <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-3 border-t border-slate-200 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <AppButton onClick={() => startPractice(practiceState.topic, practiceState.questionIndex)} variant="secondary" size="lg" className="w-full">
                重新练习
              </AppButton>
              <AppButton onClick={goNextQuestion} variant="success" size="lg" className="w-full" disabled={!canAdvance}>
                下一题
                <ChevronRight size={18} aria-hidden="true" />
              </AppButton>
            </div>
            {!canAdvance && advanceHint && (
              <p className="text-center text-xs text-slate-400">{advanceHint}</p>
            )}

            {/* 标记薄弱 */}
            <button
              onClick={() => setWeakTopics(prev => {
                const next = new Set(prev);
                if (next.has(practiceState.topic.topic)) {
                  next.delete(practiceState.topic.topic);
                } else {
                  next.add(practiceState.topic.topic);
                }
                return next;
              })}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-sm transition-colors ${
                weakTopics.has(practiceState.topic.topic)
                  ? 'bg-orange-100 text-orange-600'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
              }`}
            >
              <Flag size={14} />
              {weakTopics.has(practiceState.topic.topic) ? '已标记为薄弱话题' : '标记为薄弱话题'}
            </button>
          </div>
        )}
      </PageContent>
    </PageShell>
  );
}

/** 参考答案折叠组件 */
function ReferenceAnswer({ answer }: { answer: string }) {
  const [show, setShow] = useState(true);

  if (!answer) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setShow(!show)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
          <BookOpen size={16} />
          <span className="font-medium text-sm">参考答案</span>
        </div>
        <span className="text-xs text-gray-400">{show ? '收起' : '展开'}</span>
      </button>
      {show && (
        <div className="px-4 pb-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}
