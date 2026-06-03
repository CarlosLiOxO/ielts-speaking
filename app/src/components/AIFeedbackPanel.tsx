/**
 * AI 评分反馈面板
 * 展示 Mimo 的口语评分结果
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Target, Wand2 } from 'lucide-react';
import { getAIFeedback } from '../services/ai';
import { AIRequestStatus } from './AIRequestStatus';
import { AppButton, IconButton } from './ui';

export type FeedbackStatus = 'idle' | 'loading' | 'success' | 'error';

interface AIFeedbackPanelProps {
  question: string;
  transcript: string;
  part: 'part1' | 'part2' | 'part3';
  preloadedFeedback?: string;
  autoRequest?: boolean;
  onStatusChange?: (status: FeedbackStatus) => void;
  onFeedbackReceived?: (feedback: string) => void;
}

const focusItems = [
  'Fluency',
  'Lexical',
  'Grammar',
  'Pronunciation',
];

function extractBand(feedback: string): string | null {
  const match = feedback.match(/(?:Band|分数|总分)\s*[:：]?\s*([0-9](?:\.[05])?)/i);
  return match?.[1] || null;
}

export function AIFeedbackPanel({
  question,
  transcript,
  part,
  preloadedFeedback,
  autoRequest = false,
  onStatusChange,
  onFeedbackReceived,
}: AIFeedbackPanelProps) {
  const [feedback, setFeedback] = useState(preloadedFeedback || '');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState('');
  const requestedKeyRef = useRef('');
  const band = extractBand(feedback);

  const requestFeedback = useCallback(async () => {
    if (!transcript.trim()) {
      setError('没有转写文本可以评分');
      onStatusChange?.('error');
      return;
    }

    setLoading(true);
    setError('');
    onStatusChange?.('loading');

    try {
      const result = await getAIFeedback('', question, transcript, part);
      setFeedback(result);
      onFeedbackReceived?.(result);
      onStatusChange?.('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取评分失败，请检查网络和 API Key');
      onStatusChange?.('error');
    } finally {
      setLoading(false);
    }
  }, [onFeedbackReceived, onStatusChange, part, question, transcript]);

  useEffect(() => {
    if (preloadedFeedback) {
      onStatusChange?.('success');
      return;
    }
    if (!autoRequest || !transcript.trim() || feedback || loading) return;
    const requestKey = `${part}:${question}:${transcript}`;
    if (requestedKeyRef.current === requestKey) return;
    requestedKeyRef.current = requestKey;
    void requestFeedback();
  }, [autoRequest, feedback, loading, onStatusChange, part, preloadedFeedback, question, requestFeedback, transcript]);

  if (!transcript.trim()) {
    return (
      <section className="overflow-hidden rounded-[22px] border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={18} className="text-amber-500" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">AI 评分报告</p>
        </div>
        <AIRequestStatus type="error" message="没有识别到有效转写文本，暂时无法评分。请重新录音，或确认录音时长和麦克风权限。" compact />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[22px] border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 shadow-[0_12px_32px_rgba(88,28,135,0.08)] dark:border-purple-800 dark:from-purple-950/40 dark:via-slate-900 dark:to-indigo-950/30">
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles size={18} className="text-purple-500" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-300">AI 评分报告</p>
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{feedback ? '本次回答反馈已生成' : '让 Mimo 生成一次评分反馈'}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">按雅思口语四项能力给出复盘建议和下一步练习方向。</p>
        </div>
        {feedback && (
          <div className="shrink-0 rounded-2xl bg-white px-3 py-2 text-center shadow-sm dark:bg-slate-800">
            <p className="text-[10px] font-semibold uppercase text-purple-500">Band</p>
            <p className="text-xl font-bold text-purple-700 dark:text-purple-200">{band || '—'}</p>
          </div>
        )}
        {feedback && (
          <IconButton
            label={expanded ? '收起评分反馈' : '展开评分反馈'}
            onClick={() => setExpanded(!expanded)}
            icon={expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
            className="text-purple-500 hover:bg-purple-100"
          />
        )}
      </div>

      {!feedback && !loading && (
        <div className="px-5 pb-5">
          <AppButton onClick={requestFeedback} className="w-full bg-purple-500 hover:bg-purple-600" size="lg">
            <Wand2 size={18} aria-hidden="true" />
            获取评分
          </AppButton>
        </div>
      )}

      {loading && <div className="px-5 pb-5"><AIRequestStatus type="thinking" message="Mimo 正在生成评分反馈…" compact /></div>}
      {error && <div className="px-5 pb-5"><AIRequestStatus type="error" message={error} actionLabel="重试" onAction={requestFeedback} compact /></div>}

      {feedback && expanded && (
        <div className="space-y-4 px-5 pb-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {focusItems.map(item => (
              <div key={item} className="rounded-2xl bg-white/80 p-3 text-center dark:bg-slate-800/70">
                <p className="text-xs font-semibold text-slate-500">{item}</p>
                <div className="mt-2 h-1.5 rounded-full bg-purple-100 dark:bg-purple-900/40">
                  <div className="h-full w-2/3 rounded-full bg-purple-500" />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-purple-100 bg-white/85 p-4 dark:border-purple-900 dark:bg-slate-900/80">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-200">
              <Target size={16} aria-hidden="true" />
              详细反馈
            </div>
            <div className="space-y-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {feedback.split('\n').filter(Boolean).map((line, i) => {
                const isHeaderLine = /^\*\*[^*]/.test(line);
                const parts = line.split(/(\*\*[^*]+\*\*)/);
                return (
                  <p key={i} className={isHeaderLine ? 'mt-2 font-semibold text-purple-700 dark:text-purple-300' : ''}>
                    {parts.map((part, j) =>
                      /^\*\*[^*]+\*\*$/.test(part)
                        ? <strong key={j}>{part.slice(2, -2)}</strong>
                        : part
                    )}
                  </p>
                );
              })}
            </div>
          </div>

          <AppButton onClick={requestFeedback} variant="secondary" size="sm">
            重新评分
          </AppButton>
        </div>
      )}
    </section>
  );
}
