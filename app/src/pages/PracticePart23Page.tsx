/**
 * Part 2 & 3 练习页面
 * Part 2：1分钟准备 + 2分钟独白
 * Part 3：深度追问练习
 */
import { useState } from 'react';
import { Volume2, ChevronRight, Clock, BookOpen, Lightbulb, Shuffle } from 'lucide-react';
import questionsData from '../data/questions.json';
import { useAppStore } from '../stores/useAppStore';
import { RecorderPanel } from '../components/RecorderPanel';
import { AIFeedbackPanel } from '../components/AIFeedbackPanel';
import { Timer } from '../components/Timer';
import { AppButton, IconButton, PageContent, PageHeader, PageShell, PromptCard, SegmentedFilter } from '../components/ui';
import { saveRecord, updateRecordFeedback } from '../services/db';
import { preloadSpeech as preloadMimoSpeech, retryLastSpeech, speak as speakMimo } from '../services/tts';
import { useTTSStatus } from '../hooks/useTTSStatus';
import { AIRequestStatus } from '../components/AIRequestStatus';
import { generateKeywordHints } from '../services/ai';
import type { Part23Card, SpeechStats } from '../types';

const TTS_SOURCE = 'practice-part23';

const allCards: (Part23Card & { category: string })[] = [
  ...questionsData.part23.保留题.map(c => ({ ...c, category: '保留题' })),
  ...questionsData.part23.旧题.map(c => ({ ...c, category: '旧题' })),
].filter(c => c.part2 !== null);

type Step = 'select' | 'prep' | 'part2' | 'part2-result' | 'part3' | 'part3-result';

export function PracticePart23Page() {
  const { setPage, settings } = useAppStore();
  const ttsStatus = useTTSStatus(TTS_SOURCE);
  const [step, setStep] = useState<Step>('select');
  const [selectedCard, setSelectedCard] = useState<(Part23Card & { category: string }) | null>(null);
  const [part3Index, setPart3Index] = useState(0);
  const [keywordHints, setKeywordHints] = useState<string[]>([]);
  const [hintsLoading, setHintsLoading] = useState(false);
  const [hintsError, setHintsError] = useState('');
  const [part2Transcript, setPart2Transcript] = useState('');
  const [part3Transcript, setPart3Transcript] = useState('');
  const [part2RecordId, setPart2RecordId] = useState<number | null>(null);
  const [part3RecordId, setPart3RecordId] = useState<number | null>(null);
  const [prepRunning, setPrepRunning] = useState(false);
  const [filter, setFilter] = useState<'all' | '保留题' | '旧题'>('all');

  const filteredCards = filter === 'all' ? allCards : allCards.filter(c => c.category === filter);
  const speak = (text: string) => speakMimo(text, { source: TTS_SOURCE });
  const preloadSpeech = (text: string) => preloadMimoSpeech(text, { source: TTS_SOURCE });

  /** 生成 Part 2 关键词提示 */
  const generateHintsForCard = async (card: Part23Card & { category: string }) => {
    if (!card.part2) return;
    setHintsLoading(true);
    setHintsError('');
    try {
      const hints = await generateKeywordHints('', card.titleZh, card.part2.prompt);
      setKeywordHints(hints);
    } catch (err) {
      console.warn('关键词提示生成失败，使用空提示:', err instanceof Error ? err.message : err);
      setKeywordHints([]);
      setHintsError(err instanceof Error ? err.message : '关键词提示生成失败');
    } finally {
      setHintsLoading(false);
    }
  };

  /** 选择并开始练习某张卡片 */
  const startCard = async (card: Part23Card & { category: string }) => {
    setSelectedCard(card);
    setKeywordHints([]);
    setHintsError('');
    setPart2Transcript('');
    setPart3Transcript('');
    setPart2RecordId(null);
    setPart3RecordId(null);
    setPart3Index(0);
    setStep('prep');
    setPrepRunning(true);

    // 播报并预加载题目
    if (settings.enableTTS && card.part2) {
      preloadSpeech(card.part2.prompt);
      speak(card.part2.prompt);
      if (card.part3Questions[0]) preloadSpeech(card.part3Questions[0].question);
    }

    void generateHintsForCard(card);
  };

  /** 随机选题 */
  const pickRandom = () => {
    const card = filteredCards[Math.floor(Math.random() * filteredCards.length)];
    startCard(card);
  };

  /** Part 2 录音完成 */
  const handlePart2Complete = async (data: {
    transcript: string;
    audioBlob: Blob | null;
    stats: SpeechStats | null;
    duration: number;
  }) => {
    setPart2Transcript(data.transcript);

    if (selectedCard?.part2) {
      const recordId = await saveRecord({
        date: new Date().toISOString(),
        part: 'part2',
        topicOrTitle: selectedCard.titleZh,
        question: selectedCard.part2.prompt,
        transcript: data.transcript,
        audioBlob: data.audioBlob || undefined,
        duration: data.duration,
        wordCount: data.stats?.wordCount || 0,
        speechRate: data.stats?.speechRate || 0,
        pauseCount: data.stats?.pauseCount || 0,
      });
      setPart2RecordId(recordId);
    }

    setStep('part2-result');
  };

  /** Part 3 录音完成 */
  const handlePart3Complete = async (data: {
    transcript: string;
    audioBlob: Blob | null;
    stats: SpeechStats | null;
    duration: number;
  }) => {
    setPart3Transcript(data.transcript);

    if (selectedCard) {
      const q = selectedCard.part3Questions[part3Index];
      const recordId = await saveRecord({
        date: new Date().toISOString(),
        part: 'part3',
        topicOrTitle: selectedCard.titleZh,
        question: q?.question || '',
        transcript: data.transcript,
        audioBlob: data.audioBlob || undefined,
        duration: data.duration,
        wordCount: data.stats?.wordCount || 0,
        speechRate: data.stats?.speechRate || 0,
        pauseCount: data.stats?.pauseCount || 0,
      });
      setPart3RecordId(recordId);
    }

    setStep('part3-result');
  };

  const currentPart2 = selectedCard?.part2;
  const currentPart3Q = selectedCard?.part3Questions[part3Index];

  return (
    <PageShell>
      <PageHeader
        title="Part 2 & 3 练习"
        subtitle={step === 'select' ? '长回答结构训练与深度追问' : selectedCard?.titleZh}
        backLabel={step === 'select' ? '返回首页' : '返回选题列表'}
        onBack={() => step === 'select' ? setPage('home') : setStep('select')}
        actions={
          <AppButton onClick={pickRandom} variant="secondary" size="sm">
            <Shuffle size={14} aria-hidden="true" />
            随机
          </AppButton>
        }
      />

      <PageContent className="space-y-4">
        {ttsStatus.status === 'loading' && <AIRequestStatus type="loading" message={ttsStatus.message} />}
        {ttsStatus.status === 'playing' && <AIRequestStatus type="speaking" message={ttsStatus.message} />}
        {ttsStatus.status === 'error' && <AIRequestStatus type="error" message={ttsStatus.message} actionLabel="重试" onAction={retryLastSpeech} />}
        {hintsLoading && <AIRequestStatus type="thinking" message="Mimo 正在生成 Part 2 关键词提示…" />}
        {hintsError && selectedCard && <AIRequestStatus type="error" message={hintsError} actionLabel="重新生成" onAction={() => void generateHintsForCard(selectedCard)} />}

        {/* ===== 选题列表 ===== */}
        {step === 'select' && (
          <div>
            <div className="mb-4">
              <SegmentedFilter
                label="Part 2 和 Part 3 题目分类"
                value={filter}
                onChange={(next) => setFilter(next as typeof filter)}
                options={[
                  { value: 'all', label: '全部' },
                  { value: '保留题', label: '保留题' },
                  { value: '旧题', label: '旧题' },
                ]}
              />
            </div>
            <div className="grid gap-2">
              {filteredCards.map((card, i) => (
                <button key={i} onClick={() => startCard(card)}
                  className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white text-sm">{card.titleZh}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {card.part3Questions.length} 个 Part 3 问题 · {card.category}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===== Part 2 准备阶段（1分钟）===== */}
        {step === 'prep' && currentPart2 && selectedCard && (
          <div className="flex flex-col gap-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-amber-600" />
                  <span className="font-semibold text-amber-800 dark:text-amber-200">准备时间</span>
                </div>
                <Timer
                  mode="countdown"
                  initialSeconds={settings.practiceMode === 'warmup' ? 120 : 60}
                  running={prepRunning}
                  onTimeUp={() => setStep('part2')}
                  className="text-3xl text-amber-700"
                />
              </div>

              {/* 题目卡 */}
              <PromptCard
                className="mb-3 shadow-none"
                action={<IconButton label="播放题目" onClick={() => speak(currentPart2.prompt)} icon={<Volume2 size={16} aria-hidden="true" />} />}
              >
                <p className="font-semibold leading-relaxed text-slate-900 dark:text-white">{currentPart2.prompt}</p>
                {currentPart2.cueCard.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {currentPart2.cueCard.map((point, i) => (
                      <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                        <span className="text-gray-400">•</span>{point}
                      </li>
                    ))}
                  </ul>
                )}
              </PromptCard>

              {/* 关键词提示 */}
              {(keywordHints.length > 0 || hintsLoading) && (
                <div className="flex flex-wrap gap-2">
                  <Lightbulb size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  {hintsLoading ? (
                    <span className="text-xs text-amber-600">生成提示词…</span>
                  ) : (
                    keywordHints.map((hint, i) => (
                      <span key={i} className="text-xs bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-200 px-2 py-1 rounded-full">
                        {hint}
                      </span>
                    ))
                  )}
                </div>
              )}
            </div>

            <AppButton onClick={() => { setPrepRunning(false); setStep('part2'); }} size="lg" className="w-full">
              准备好了，开始作答
            </AppButton>
          </div>
        )}

        {/* ===== Part 2 答题 ===== */}
        {step === 'part2' && currentPart2 && selectedCard && (
          <div className="flex flex-col gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Part 2</span>
                <span className="text-sm text-gray-500">独白，约 1.5-2 分钟</span>
              </div>
              <p className="font-medium text-gray-800 dark:text-white leading-relaxed">{currentPart2.prompt}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <RecorderPanel
                onComplete={handlePart2Complete}
                timeLimit={settings.practiceMode === 'stress' ? 120 : 0}
              />
            </div>
          </div>
        )}

        {/* ===== Part 2 结果 ===== */}
        {step === 'part2-result' && currentPart2 && selectedCard && (
          <div className="flex flex-col gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Part 2 题目</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white">{currentPart2.prompt}</p>
            </div>

            {part2Transcript && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 mb-1">你的回答</p>
                <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{part2Transcript}</p>
              </div>
            )}

            <AIFeedbackPanel
              question={currentPart2.prompt}
              transcript={part2Transcript}
              part="part2"
              onFeedbackReceived={(feedback) => {
                if (part2RecordId) void updateRecordFeedback(part2RecordId, feedback);
              }}
            />

            <ReferenceAnswer answer={currentPart2.sampleAnswer} />

            <div className="flex gap-3">
              <button onClick={() => startCard(selectedCard)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium">
                重练 Part 2
              </button>
              {selectedCard.part3Questions.length > 0 && (
                <button
                  onClick={() => {
                    setPart3Index(0);
                    setStep('part3');
                    if (settings.enableTTS) {
                      preloadSpeech(selectedCard.part3Questions[0].question);
                      speak(selectedCard.part3Questions[0].question);
                      if (selectedCard.part3Questions[1]) preloadSpeech(selectedCard.part3Questions[1].question);
                    }
                  }}
                  className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  继续 Part 3
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===== Part 3 答题 ===== */}
        {step === 'part3' && currentPart3Q && selectedCard && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-xs font-semibold">Part 3</span>
              <span>{part3Index + 1} / {selectedCard.part3Questions.length}</span>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <p className="text-lg font-medium text-gray-800 dark:text-white leading-relaxed flex-1">
                  {currentPart3Q.question}
                </p>
                <IconButton label="播放题目" onClick={() => speak(currentPart3Q.question)} icon={<Volume2 size={18} aria-hidden="true" />} />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <RecorderPanel
                onComplete={handlePart3Complete}
                timeLimit={settings.practiceMode === 'stress' ? 60 : 0}
              />
            </div>
          </div>
        )}

        {/* ===== Part 3 结果 ===== */}
        {step === 'part3-result' && currentPart3Q && selectedCard && (
          <div className="flex flex-col gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Part 3 问题</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white">{currentPart3Q.question}</p>
            </div>

            {part3Transcript && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 mb-1">你的回答</p>
                <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{part3Transcript}</p>
              </div>
            )}

            <AIFeedbackPanel
              question={currentPart3Q.question}
              transcript={part3Transcript}
              part="part3"
              onFeedbackReceived={(feedback) => {
                if (part3RecordId) void updateRecordFeedback(part3RecordId, feedback);
              }}
            />

            <ReferenceAnswer answer={currentPart3Q.answer} />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('part3');
                  if (settings.enableTTS) speak(currentPart3Q.question);
                }}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium"
              >
                重练此题
              </button>
              {part3Index < selectedCard.part3Questions.length - 1 ? (
                <button
                  onClick={() => {
                    const next = part3Index + 1;
                    setPart3Index(next);
                    setStep('part3');
                    if (settings.enableTTS) {
                      preloadSpeech(selectedCard.part3Questions[next].question);
                      speak(selectedCard.part3Questions[next].question);
                      if (selectedCard.part3Questions[next + 1]) preloadSpeech(selectedCard.part3Questions[next + 1].question);
                    }
                  }}
                  className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  下一题 <ChevronRight size={18} />
                </button>
              ) : (
                <button onClick={() => setStep('select')}
                  className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium">
                  完成练习
                </button>
              )}
            </div>
          </div>
        )}
      </PageContent>
    </PageShell>
  );
}

function ReferenceAnswer({ answer }: { answer: string }) {
  const [show, setShow] = useState(false);
  if (!answer) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button onClick={() => setShow(!show)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-750">
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
