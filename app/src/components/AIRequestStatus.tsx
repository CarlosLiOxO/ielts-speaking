/**
 * Mimo 请求状态提示组件
 * 统一展示 TTS、STT、AI 评分和考官回复等异步请求状态
 */
import { Loader2, AlertCircle, Volume2, Brain, Mic } from 'lucide-react';

export type AIRequestStatusType = 'loading' | 'speaking' | 'error' | 'transcribing' | 'thinking';

interface AIRequestStatusProps {
  type: AIRequestStatusType;
  message: string;
  compact?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

const statusStyle = {
  loading: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  speaking: 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
  error: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  transcribing: 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800',
  thinking: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800',
};

/** 根据状态类型渲染对应图标 */
function StatusIcon({ type }: { type: AIRequestStatusType }) {
  if (type === 'error') return <AlertCircle size={16} aria-hidden="true" />;
  if (type === 'speaking') return <Volume2 size={16} aria-hidden="true" />;
  if (type === 'transcribing') return <Mic size={16} aria-hidden="true" />;
  if (type === 'thinking') return <Brain size={16} aria-hidden="true" />;
  return <Loader2 size={16} className="animate-spin" aria-hidden="true" />;
}

/** 展示 Mimo 异步请求状态 */
export function AIRequestStatus({ type, message, compact = false, actionLabel, onAction }: AIRequestStatusProps) {
  const isError = type === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`flex items-center gap-2 rounded-xl border ${statusStyle[type]} ${compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'}`}
    >
      <StatusIcon type={type} />
      <span className="font-medium flex-1">{message}</span>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="shrink-0 rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium hover:bg-white dark:bg-gray-900/30 dark:hover:bg-gray-900/50"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
