/**
 * 录音 Hook
 * 管理麦克风录音、音频数据收集和语音统计
 */
import { useState, useRef, useCallback } from 'react';
import { analyzeSpeech } from '../services/speechStats';
import type { SpeechStats } from '../types';

export type RecorderState = 'idle' | 'recording' | 'stopped';

export interface RecorderResult {
  state: RecorderState;
  duration: number;           // 录音时长（秒）
  audioBlob: Blob | null;     // 录音文件
  stats: SpeechStats | null;  // 语音统计
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

/**
 * 使用麦克风录音
 * @param transcript 外部传入的转写文本（用于统计分析）
 */
export function useRecorder(transcript: string): RecorderResult {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [stats, setStats] = useState<SpeechStats | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 开始录音 */
  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);

        // 计算最终时长
        const finalDuration = (Date.now() - startTimeRef.current) / 1000;
        setDuration(finalDuration);

        // 生成统计数据
        const speechStats = analyzeSpeech(transcript, finalDuration);
        setStats(speechStats);
      };

      recorder.start(100); // 每100ms收集一次数据
      setState('recording');

      // 更新录音时长计时器
      timerRef.current = setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 200);
    } catch (err) {
      console.error('录音启动失败:', err);
    }
  }, [transcript]);

  /** 停止录音 */
  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setState('stopped');
    }
  }, []);

  /** 重置录音状态 */
  const reset = useCallback(() => {
    stop();
    setState('idle');
    setDuration(0);
    setAudioBlob(null);
    setStats(null);
    chunksRef.current = [];
  }, [stop]);

  return { state, duration, audioBlob, stats, start, stop, reset };
}
