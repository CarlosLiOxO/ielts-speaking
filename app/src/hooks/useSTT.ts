/**
 * 语音识别 Hook
 * 管理 Mimo 录音后转写和短语音输入转写
 */
import { useState, useRef, useCallback } from 'react';
import { startSTT, transcribeAudioBlob, type STTSession } from '../services/stt';

export interface STTHookResult {
  transcript: string;         // 最终转写结果
  interimTranscript: string;  // 转写中状态文本
  isListening: boolean;
  isTranscribing: boolean;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  transcribeBlob: (blob: Blob, durationSeconds?: number) => Promise<string>;
  clearTranscript: () => void;
}

/** 使用语音识别 Hook */
export function useSTT(): STTHookResult {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<STTSession | null>(null);

  /** 开始短语音输入录音 */
  const startListening = useCallback(async () => {
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    setIsListening(true);

    sessionRef.current = await startSTT(
      (text, isFinal) => {
        if (isFinal) {
          setTranscript(text);
          setInterimTranscript('');
          setIsTranscribing(false);
          setIsListening(false);
        } else {
          setInterimTranscript(text);
          setIsTranscribing(true);
        }
      },
      (err) => {
        setError(err);
        setIsListening(false);
        setIsTranscribing(false);
      }
    );
  }, []);

  /** 停止短语音输入录音并触发 Mimo 转写 */
  const stopListening = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setIsListening(false);
    setIsTranscribing(true);
    setInterimTranscript('Mimo 正在转写…');
  }, []);

  /** 对指定录音 Blob 进行 Mimo 转写 */
  const transcribeBlob = useCallback(async (blob: Blob, durationSeconds?: number): Promise<string> => {
    setError(null);
    setIsTranscribing(true);
    setInterimTranscript('Mimo 正在转写…');

    try {
      const text = await transcribeAudioBlob(blob, durationSeconds);
      setTranscript(text);
      setInterimTranscript('');
      return text;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mimo 转写失败';
      setError(message);
      throw new Error(message);
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  /** 清空转写结果 */
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    setIsTranscribing(false);
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isTranscribing,
    error,
    startListening,
    stopListening,
    transcribeBlob,
    clearTranscript,
  };
}
