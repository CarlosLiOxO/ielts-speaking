/**
 * 闪卡模式页面
 * 正面显示题目，背面显示参考要点，快速翻阅不录音
 */
import { useState, useCallback } from 'react';
import { RotateCcw, ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import questionsData from '../data/questions.json';
import { useAppStore } from '../stores/useAppStore';
import { retryLastSpeech, speak as speakMimo } from '../services/tts';
import { useTTSStatus } from '../hooks/useTTSStatus';
import { AIRequestStatus } from '../components/AIRequestStatus';
import { IconButton, PageContent, PageHeader, PageShell, SegmentedFilter } from '../components/ui';

// 所有 Part 1 题目摊平为闪卡
const part1Cards = [
  ...questionsData.part1.必考题,
  ...questionsData.part1.保留题,
  ...questionsData.part1.旧题,
].flatMap(topic =>
  topic.questions.map(q => ({
    topic: topic.topic,
    question: q.question,
    answer: q.answer,
    type: 'part1' as const,
  }))
);

// Part 2&3 摊平
const part23Cards = [
  ...questionsData.part23.保留题,
  ...questionsData.part23.旧题,
].filter(c => c.part2).flatMap(card => [
  {
    topic: card.titleZh,
    question: card.part2!.prompt,
    answer: card.part2!.sampleAnswer.slice(0, 300) + '…',
    type: 'part2' as const,
  },
  ...card.part3Questions.map(q => ({
    topic: card.titleZh,
    question: q.question,
    answer: q.answer,
    type: 'part3' as const,
  })),
]);

const allCards = [...part1Cards, ...part23Cards];
const TTS_SOURCE = 'flashcard';

/** Fisher-Yates 洗牌 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type FilterType = 'all' | 'part1' | 'part2' | 'part3';

const typeColor = {
  part1: 'bg-blue-100 text-blue-600',
  part2: 'bg-purple-100 text-purple-600',
  part3: 'bg-green-100 text-green-600',
};

export function FlashcardPage() {
  const { setPage } = useAppStore();
  const ttsStatus = useTTSStatus(TTS_SOURCE);
  const [filter, setFilter] = useState<FilterType>('all');
  const [cards, setCards] = useState(() => shuffle(allCards));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const filtered = filter === 'all' ? cards : cards.filter(c => c.type === filter);
  const card = filtered[index % Math.max(filtered.length, 1)];

  /** 翻牌 */
  const flip = () => setFlipped(f => !f);

  /** 下一张 */
  const next = useCallback(() => {
    setFlipped(false);
    setIndex(i => (i + 1) % filtered.length);
  }, [filtered.length]);

  /** 上一张 */
  const prev = useCallback(() => {
    setFlipped(false);
    setIndex(i => (i - 1 + filtered.length) % filtered.length);
  }, [filtered.length]);

  /** 重新洗牌 */
  const reshuffle = () => {
    setCards(shuffle(allCards));
    setIndex(0);
    setFlipped(false);
  };

  if (!card) return null;

  return (
    <PageShell>
      <PageHeader
        title="闪卡模式"
        subtitle="键盘可翻卡，快速复习薄弱题"
        backLabel="返回首页"
        onBack={() => setPage('home')}
        actions={<IconButton icon={<RotateCcw size={18} aria-hidden="true" />} label="重新洗牌" onClick={reshuffle} />}
      />

      <PageContent maxWidth="sm" className="space-y-4">
        {ttsStatus.status === 'loading' && <AIRequestStatus type="loading" message={ttsStatus.message} />}
        {ttsStatus.status === 'playing' && <AIRequestStatus type="speaking" message={ttsStatus.message} />}
        {ttsStatus.status === 'error' && <AIRequestStatus type="error" message={ttsStatus.message} actionLabel="重试" onAction={retryLastSpeech} />}
        <SegmentedFilter
          label="闪卡分类"
          value={filter}
          onChange={(next) => { setFilter(next as FilterType); setIndex(0); setFlipped(false); }}
          options={[
            { value: 'all', label: '全部' },
            { value: 'part1', label: 'Part 1' },
            { value: 'part2', label: 'Part 2' },
            { value: 'part3', label: 'Part 3' },
          ]}
        />

        {/* 进度 */}
        <p className="text-center text-sm text-gray-400 mb-4">
          {(index % filtered.length) + 1} / {filtered.length}
        </p>

        {/* 闪卡 */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={flipped}
          aria-label={flipped ? '翻回题目' : '查看参考答案'}
          className="relative cursor-pointer rounded-3xl"
          onClick={flip}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              flip();
            }
          }}
          style={{ perspective: '1000px' }}
        >
          <div
            className="relative w-full transition-transform duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              minHeight: '280px',
            }}
          >
            {/* 正面 */}
            <div
              className="absolute inset-0 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-lg p-6 flex flex-col"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor[card.type]}`}>
                  {card.type.toUpperCase()}
                </span>
                <span className="text-xs text-gray-400">{card.topic}</span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <p className="text-lg font-medium text-gray-800 dark:text-white text-center leading-relaxed">
                  {card.question}
                </p>
              </div>
              <p className="text-center text-xs text-gray-400 mt-4">点击翻牌查看参考答案</p>
            </div>

            {/* 背面 */}
            <div
              className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-3xl border border-blue-200 dark:border-blue-700 shadow-lg p-6 flex flex-col"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-blue-500">参考答案</span>
                <button
                  type="button"
                  aria-label="播放题目"
                  onClick={(e) => { e.stopPropagation(); speakMimo(card.question, { source: TTS_SOURCE }); }}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-blue-100 text-blue-400"
                >
                  <Volume2 size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{card.answer}</p>
              </div>
              <p className="text-center text-xs text-gray-400 mt-4">点击翻回题目</p>
            </div>
          </div>
        </div>

        {/* 导航按钮 */}
        <div className="flex items-center justify-center gap-6 mt-8">
          <button onClick={prev}
            className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-colors">
            <ChevronLeft size={20} />
            上一张
          </button>
          <button onClick={next}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-3 rounded-xl transition-colors">
            下一张
            <ChevronRight size={20} />
          </button>
        </div>
      </PageContent>
    </PageShell>
  );
}
