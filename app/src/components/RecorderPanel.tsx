/**
 * 录音面板组件
 * 集成录音控制、Mimo 停止后转写、语音统计展示
 */
import { useEffect, useRef } from 'react';
import { Mic, MicOff, Square, RotateCcw } from 'lucide-react';
import { useRecorder } from '../hooks/useRecorder';
import { useSTT } from '../hooks/useSTT';
import { useAppStore } from '../stores/useAppStore';
import { Timer } from './Timer';
import { AIRequestStatus } from './AIRequestStatus';
import { analyzeSpeech, getSpeechRateEvaluation, getPauseEvaluation } from '../services/speechStats';
import type { SpeechStats } from '../types';

interface RecorderPanelProps {
  /** 录音完成回调 */
  onComplete: (data: {
    transcript: string;
    audioBlob: Blob | null;
    stats: SpeechStats | null;
    duration: number;
  }) => void;
  /** 压力模式限时（秒），0 表示无限制 */
  timeLimit?: number;
  /** 是否自动开始 */
  autoStart?: boolean;
}

export function RecorderPanel({ onComplete, timeLimit = 0, autoStart = false }: RecorderPanelProps) {
  const { settings } = useAppStore();
  const stt = useSTT();
  const recorder = useRecorder(stt.transcript);

  const displayText = stt.transcript || stt.interimTranscript;
  const processedAudioRef = useRef<Blob | null>(null);

  // 用 ref 保持 onComplete 最新引用，避免 effect 捕获过期闭包又不希望频繁更新依赖
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  /** 开始录音 */
  const handleStart = async () => {
    processedAudioRef.current = null;
    stt.clearTranscript();
    await recorder.start();
  };

  /** 停止录音并等待录音 Blob 生成后转写 */
  const handleStop = () => {
    recorder.stop();
  };

  /** 重置 */
  const handleReset = () => {
    recorder.reset();
    stt.clearTranscript();
  };

  /** 重新使用当前录音进行 Mimo 转写 */
  const retryTranscribe = () => {
    if (!recorder.audioBlob) return;
    stt.transcribeBlob(recorder.audioBlob, recorder.duration)
      .then((transcript) => {
        onCompleteRef.current({
          transcript,
          audioBlob: recorder.audioBlob,
          stats: analyzeSpeech(transcript, recorder.duration),
          duration: recorder.duration,
        });
      })
      .catch(() => {});
  };

  /** 录音完成后先用 Mimo 转写，再触发完成回调 */
  useEffect(() => {
    if (recorder.state !== 'stopped' || !recorder.audioBlob || processedAudioRef.current === recorder.audioBlob) return;

    processedAudioRef.current = recorder.audioBlob;

    if (!settings.enableSTT) {
      onCompleteRef.current({
        transcript: '',
        audioBlob: recorder.audioBlob,
        stats: recorder.stats,
        duration: recorder.duration,
      });
      return;
    }

    stt.transcribeBlob(recorder.audioBlob, recorder.duration)
      .then((transcript) => {
        onCompleteRef.current({
          transcript,
          audioBlob: recorder.audioBlob,
          stats: analyzeSpeech(transcript, recorder.duration),
          duration: recorder.duration,
        });
      })
      .catch(() => {
        onCompleteRef.current({
          transcript: '',
          audioBlob: recorder.audioBlob,
          stats: recorder.stats,
          duration: recorder.duration,
        });
      });
  }, [recorder.state, recorder.audioBlob, recorder.stats, recorder.duration, settings.enableSTT, stt]);

  // autoStart 为静态 prop，仅挂载时执行一次，无需追踪内部函数依赖
  const settingsRef = useRef(settings);
  const sttRef = useRef(stt);
  const recorderRef = useRef(recorder);
  useEffect(() => {
    settingsRef.current = settings;
    sttRef.current = stt;
    recorderRef.current = recorder;
  });
  useEffect(() => {
    if (!autoStart) return;
    const sttInst = sttRef.current;
    const recInst = recorderRef.current;
    sttInst.clearTranscript();
    recInst.start();
  // autoStart 仅在挂载时生效；内部依赖均通过 refs 读取，无需列入依赖数组
  }, [autoStart]);

  const isRecording = recorder.state === 'recording';
  const isStopped = recorder.state === 'stopped';
  const recorderStatus = stt.isTranscribing ? '转写中' : stt.error ? '转写失败' : isRecording ? '录音中' : isStopped ? '已完成' : '准备录音';
  const recorderStatusClass = stt.error ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-200' : stt.isTranscribing ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-200' : isRecording ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-200' : isStopped ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300';

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${recorderStatusClass}`}>{recorderStatus}</span>
        <div className="text-right text-xs text-slate-400">
          {timeLimit > 0 ? '限时作答' : '自由练习'}
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
        {displayText ? (
          <p className="min-h-16 text-base leading-relaxed text-slate-800 dark:text-slate-100">
            {stt.transcript}
            {stt.interimTranscript && <span className="text-slate-400 italic">{' '}{stt.interimTranscript}</span>}
          </p>
        ) : (
          <div className="flex min-h-16 items-center justify-center text-center text-sm text-slate-400">
            {isRecording ? '正在录音，停止后将用 Mimo 转写…' : '点击麦克风开始录音，回答会自动转写。'}
          </div>
        )}
        {stt.isTranscribing && <div className="mt-3"><AIRequestStatus type="transcribing" message="Mimo 正在转写录音，请稍候…" compact /></div>}
        {stt.error && <div className="mt-3"><AIRequestStatus type="error" message={stt.error} actionLabel="重新转写" onAction={retryTranscribe} compact /></div>}
      </div>

      <div className="mb-5 flex flex-col items-center gap-4">
        <div className={`flex h-28 w-28 items-center justify-center rounded-full border-8 ${isRecording ? 'border-red-100 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-900/20' : 'border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/40 dark:bg-blue-900/20'}`}>
          {timeLimit > 0 ? (
            <Timer mode="countdown" initialSeconds={timeLimit} running={isRecording} onTimeUp={handleStop} className="text-3xl" />
          ) : (
            <Timer mode="countup" running={isRecording} className="text-3xl" />
          )}
        </div>
        {isRecording && (
          <div className="flex items-center gap-1" aria-hidden="true">
            {[16, 24, 20, 14].map((h, i) => (
              <div key={i} className="w-1 rounded-full bg-red-500 animate-pulse" style={{ height: `${h}px`, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        {!isRecording && !isStopped && (
          <button type="button" onClick={handleStart} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-red-500 px-7 font-semibold text-white shadow-lg transition hover:bg-red-600">
            <Mic size={20} aria-hidden="true" />
            开始录音
          </button>
        )}
        {isRecording && (
          <button type="button" onClick={handleStop} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-slate-800 px-7 font-semibold text-white transition hover:bg-slate-900">
            <Square size={18} fill="white" aria-hidden="true" />
            停止录音
          </button>
        )}
        {isStopped && (
          <button type="button" onClick={handleReset} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
            <RotateCcw size={16} aria-hidden="true" />
            重录
          </button>
        )}
      </div>

      {isStopped && recorder.stats && <div className="mt-4"><SpeechStatsPanel stats={recorder.stats} /></div>}
      {!settings.enableSTT && (
        <p className="mt-4 text-center text-xs text-slate-400">
          <MicOff size={12} className="inline mr-1" aria-hidden="true" />
          语音识别已关闭，在设置中开启
        </p>
      )}
    </div>
  );
}

/** 语音统计面板 */
function SpeechStatsPanel({ stats }: { stats: SpeechStats }) {
  const rateEval = getSpeechRateEvaluation(stats.speechRate);
  const pauseEval = getPauseEvaluation(stats.pauseCount, stats.duration);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
      <StatItem label="时长" value={`${Math.round(stats.duration)}s`} />
      <StatItem label="单词数" value={String(stats.wordCount)} />
      <StatItem
        label="语速"
        value={`${stats.speechRate} wpm`}
        valueClass={rateEval.color}
        badge={rateEval.label}
      />
      <StatItem
        label="停顿"
        value={`${stats.pauseCount} 次`}
        valueClass={pauseEval.color}
        badge={pauseEval.label}
      />
    </div>
  );
}

function StatItem({ label, value, valueClass = '', badge }: {
  label: string;
  value: string;
  valueClass?: string;
  badge?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-sm font-semibold ${valueClass || 'text-gray-800 dark:text-gray-100'}`}>
        {value}
      </p>
      {badge && <p className={`text-xs ${valueClass}`}>{badge}</p>}
    </div>
  );
}
