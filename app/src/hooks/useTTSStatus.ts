/**
 * Mimo TTS 状态 Hook
 * 将服务层 TTS 状态订阅转换为 React 状态
 */
import { useEffect, useState } from 'react';
import { getTTSState, subscribeTTSStatus, type TTSState } from '../services/tts';

const idleState: TTSState = { status: 'idle', message: '', text: '', source: '' };

/** 订阅当前 Mimo TTS 请求状态，可按页面 source 过滤 */
export function useTTSStatus(source?: string): TTSState {
  const [state, setState] = useState<TTSState>(() => {
    const current = getTTSState();
    return !source || !current.source || current.source === source ? current : idleState;
  });

  useEffect(() => subscribeTTSStatus((nextState) => {
    if (!source || !nextState.source || nextState.source === source) {
      setState(nextState);
      return;
    }
    setState(idleState);
  }), [source]);

  return state;
}
