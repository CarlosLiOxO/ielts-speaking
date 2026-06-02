/**
 * 文字转语音服务（TTS）
 * 使用 Mimo TTS 合成雅思考官语音并播放，支持内存缓存和预加载
 */

const MIMO_TTS_API_URL = '/api/mimo/tts';
const MAX_CACHE_SIZE = 30;

export type TTSStatus = 'idle' | 'loading' | 'playing' | 'error';

export interface TTSState {
  status: TTSStatus;
  message: string;
  text: string;
  source: string;
}

interface TTSOptions {
  source?: string;
  onEnd?: () => void;
}

let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let speaking = false;
let lastSpeechText = '';
let lastSpeechSource = '';
let ttsState: TTSState = { status: 'idle', message: '', text: '', source: '' };

const audioCache = new Map<string, Blob>();
const pendingRequests = new Map<string, Promise<Blob>>();
const ttsListeners = new Set<(state: TTSState) => void>();

/** 更新 TTS 状态并通知订阅者 */
function setTTSState(nextState: TTSState): void {
  ttsState = nextState;
  ttsListeners.forEach(listener => listener(ttsState));
}

/** 订阅 Mimo TTS 请求状态 */
export function subscribeTTSStatus(listener: (state: TTSState) => void): () => void {
  ttsListeners.add(listener);
  listener(ttsState);
  return () => ttsListeners.delete(listener);
}

/** 获取当前 Mimo TTS 请求状态 */
export function getTTSState(): TTSState {
  return ttsState;
}

/** 根据文本和语音配置生成稳定缓存键 */
function createCacheKey(text: string): string {
  return JSON.stringify({
    text: text.trim(),
    model: 'mimo-v2.5-tts',
    voice: 'Chloe',
    format: 'wav',
  });
}

/** 将音频 Blob 写入 LRU 风格内存缓存 */
function setCachedAudio(key: string, blob: Blob): void {
  if (audioCache.has(key)) audioCache.delete(key);
  audioCache.set(key, blob);

  while (audioCache.size > MAX_CACHE_SIZE) {
    const oldestKey = audioCache.keys().next().value;
    if (!oldestKey) break;
    audioCache.delete(oldestKey);
  }
}

/** 从缓存读取音频，并刷新最近使用顺序 */
function getCachedAudio(key: string): Blob | undefined {
  const cached = audioCache.get(key);
  if (!cached) return undefined;
  audioCache.delete(key);
  audioCache.set(key, cached);
  return cached;
}

/** 调用 Mimo TTS 代理合成音频，自动复用正在进行的相同请求 */
async function fetchSpeechAudio(text: string, notifyLoading = true, source = ''): Promise<Blob> {
  const key = createCacheKey(text);
  const cached = getCachedAudio(key);
  if (cached) return cached;

  const pending = pendingRequests.get(key);
  if (pending) return pending;

  if (notifyLoading) {
    setTTSState({ status: 'loading', message: '正在生成 Mimo 考官语音…', text, source });
  }

  const request = fetch(MIMO_TTS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model: 'mimo-v2.5-tts',
      voice: 'Chloe',
      format: 'wav',
      style: 'Professional IELTS examiner voice. Clear British English, calm, patient, and slightly slow speaking pace.',
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(error?.error || `Mimo TTS 错误 (${response.status})`);
      }

      const audioBlob = await response.blob();
      setCachedAudio(key, audioBlob);
      return audioBlob;
    })
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, request);
  return request;
}

/** 释放当前音频对象与 Object URL */
function cleanupCurrentAudio(): void {
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
  currentAudio = null;
  speaking = false;
  setTTSState({ status: 'idle', message: '', text: '', source: '' });
}

/** 预加载一段 TTS 音频，不播放 */
export function preloadSpeech(text: string, options: TTSOptions = {}): void {
  if (!text.trim()) return;
  fetchSpeechAudio(text, false, options.source || '').catch((err) => {
    console.warn('Mimo TTS 预加载失败', err);
  });
}

/**
 * 播报文字（考官语音）
 * @param text 要播报的文字
 * @param onEnd 播报结束回调
 */
export async function speak(text: string, optionsOrOnEnd?: TTSOptions | (() => void)): Promise<void> {
  stopSpeaking();

  if (!text.trim()) return;
  lastSpeechText = text;

  const options = typeof optionsOrOnEnd === 'function'
    ? { onEnd: optionsOrOnEnd }
    : optionsOrOnEnd || {};
  const source = options.source || '';
  lastSpeechSource = source;

  try {
    const audioBlob = await fetchSpeechAudio(text, true, source);
    currentAudioUrl = URL.createObjectURL(audioBlob);
    currentAudio = new Audio(currentAudioUrl);
    speaking = true;
    setTTSState({ status: 'playing', message: '正在播放 Mimo 考官语音…', text, source });

    currentAudio.onended = () => {
      cleanupCurrentAudio();
      options.onEnd?.();
    };
    currentAudio.onerror = () => {
      cleanupCurrentAudio();
      options.onEnd?.();
    };

    await currentAudio.play();
  } catch (err) {
    console.warn('Mimo TTS 播放失败', err);
    cleanupCurrentAudio();
    setTTSState({ status: 'error', message: 'Mimo 考官语音生成或播放失败', text, source });
    options.onEnd?.();
  }
}

/** 重试最近一次 Mimo TTS 播报 */
export function retryLastSpeech(): void {
  if (!lastSpeechText) return;
  void speak(lastSpeechText, { source: lastSpeechSource });
}

/** 停止当前播报 */
export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  cleanupCurrentAudio();
}

/** 检查是否正在播报 */
export function isSpeaking(): boolean {
  return speaking;
}

/** Mimo TTS 无需预加载浏览器语音，保留兼容接口 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return Promise.resolve([]);
}
