/**
 * 录音 Hook
 * 管理麦克风录音、音频数据收集和语音统计
 */
import { useState, useRef, useCallback } from 'react';
import { analyzeSpeech } from '../services/speechStats';
import type { SpeechStats } from '../types';

export type RecorderState = 'idle' | 'recording' | 'stopped';

const SPECTRUM_BARS = 24;
const SILENCE_THRESHOLD = 0.025;
const SILENCE_DURATION_MS = 1500;

export interface RecorderResult {
  state: RecorderState;
  duration: number;           // 录音时长（秒）
  audioBlob: Blob | null;     // 录音文件
  stats: SpeechStats | null;  // 语音统计
  volumeLevel: number;        // 当前整体音量 0-1
  spectrum: number[];         // 实时频谱柱状数据 0-1
  isSilent: boolean;          // 是否持续未检测到明显声音
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
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [spectrum, setSpectrum] = useState<number[]>(Array(SPECTRUM_BARS).fill(0));
  const [isSilent, setIsSilent] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);

  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    silenceStartRef.current = null;
    setVolumeLevel(0);
    setSpectrum(Array(SPECTRUM_BARS).fill(0));
    setIsSilent(false);

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const startAudioAnalysis = useCallback((stream: MediaStream) => {
    stopAudioAnalysis();

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.75;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteFrequencyData(frequencyData);
      analyser.getByteTimeDomainData(timeData);

      let sumSquares = 0;
      for (let i = 0; i < timeData.length; i += 1) {
        const centered = (timeData[i] - 128) / 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / timeData.length);
      const nextVolume = Math.min(1, rms * 3.5);
      setVolumeLevel(nextVolume);

      const bucketSize = Math.floor(frequencyData.length / SPECTRUM_BARS);
      const nextSpectrum = Array.from({ length: SPECTRUM_BARS }, (_, barIndex) => {
        const start = barIndex * bucketSize;
        const end = start + bucketSize;
        let total = 0;
        for (let i = start; i < end; i += 1) total += frequencyData[i];
        const average = total / Math.max(1, bucketSize);
        return Math.min(1, average / 255);
      });
      setSpectrum(nextSpectrum);

      const now = Date.now();
      if (nextVolume < SILENCE_THRESHOLD) {
        silenceStartRef.current ??= now;
        setIsSilent(now - silenceStartRef.current > SILENCE_DURATION_MS);
      } else {
        silenceStartRef.current = null;
        setIsSilent(false);
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, [stopAudioAnalysis]);

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
      setAudioBlob(null);
      setStats(null);
      setIsSilent(false);
      startAudioAnalysis(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopAudioAnalysis();
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
      stopAudioAnalysis();
    }
  }, [startAudioAnalysis, stopAudioAnalysis, transcript]);

  /** 停止录音 */
  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setState('stopped');
    } else {
      stopAudioAnalysis();
    }
  }, [stopAudioAnalysis]);

  /** 重置录音状态 */
  const reset = useCallback(() => {
    stop();
    stopAudioAnalysis();
    setState('idle');
    setDuration(0);
    setAudioBlob(null);
    setStats(null);
    chunksRef.current = [];
  }, [stop, stopAudioAnalysis]);

  return { state, duration, audioBlob, stats, volumeLevel, spectrum, isSilent, start, stop, reset };
}
