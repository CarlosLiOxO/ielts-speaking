/**
 * 计时器组件
 * 支持倒计时（考试模式）和正计时（练习模式）
 */
import { useEffect, useState, useRef } from 'react';

interface TimerProps {
  mode: 'countdown' | 'countup';
  initialSeconds?: number;      // 倒计时初始秒数
  onTimeUp?: () => void;        // 时间到回调
  running: boolean;
  className?: string;
}

/** 格式化秒数为 mm:ss */
function formatTime(seconds: number): string {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.abs(seconds) % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function Timer({ mode, initialSeconds = 0, onTimeUp, running, className = '' }: TimerProps) {
  const [seconds, setSeconds] = useState(mode === 'countdown' ? initialSeconds : 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpRef = useRef(onTimeUp);
  // React 19 不允许在 render 期间写 ref，改用 useEffect 保持回调最新
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // 当 mode 或 initialSeconds 变化时重置计时器
  // 使用 render 阶段状态比较替代 useEffect，避免 React 19 的 set-state-in-effect 警告
  const [prevMode, setPrevMode] = useState(mode);
  const [prevInitialSeconds, setPrevInitialSeconds] = useState(initialSeconds);
  if (prevMode !== mode || prevInitialSeconds !== initialSeconds) {
    setPrevMode(mode);
    setPrevInitialSeconds(initialSeconds);
    setSeconds(mode === 'countdown' ? initialSeconds : 0);
  }

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSeconds(prev => {
        if (mode === 'countdown') {
          const next = prev - 1;
          if (next <= 0) {
            clearInterval(intervalRef.current!);
            onTimeUpRef.current?.();
            return 0;
          }
          return next;
        } else {
          return prev + 1;
        }
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, mode]);

  // 根据剩余时间决定颜色
  const isUrgent = mode === 'countdown' && seconds <= 30 && running;
  const isWarning = mode === 'countdown' && seconds <= 60 && seconds > 30 && running;

  return (
    <span className={`font-mono font-bold tabular-nums ${
      isUrgent ? 'text-red-500' :
      isWarning ? 'text-yellow-500' :
      'text-gray-700 dark:text-gray-200'
    } ${className}`}>
      {mode === 'countdown' && seconds === 0 ? '时间到' : formatTime(seconds)}
    </span>
  );
}
