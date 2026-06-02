/**
 * 语音识别服务（Speech-to-Text）
 * 使用 Mimo 音频理解模型在停止录音后完成转写
 */

const MIMO_TRANSCRIBE_API_URL = '/api/mimo/transcribe';
const MAX_TRANSCRIBE_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_TRANSCRIBE_DURATION_SECONDS = 180;

export type STTCallback = (text: string, isFinal: boolean) => void;
export type STTErrorCallback = (error: string) => void;

/** 语音识别会话接口 */
export interface STTSession {
  stop: () => void;
}

interface MimoTranscribeResponse {
  transcript?: string;
  error?: string;
}

/** 检查录音大小和时长是否适合上传给 Mimo 转写 */
export function validateTranscribeAudio(blob: Blob, durationSeconds?: number): void {
  if (blob.size > MAX_TRANSCRIBE_AUDIO_BYTES) {
    throw new Error('录音文件过大，请缩短回答后重录（线上转写建议控制在 4MB 内）');
  }

  if (durationSeconds && durationSeconds > MAX_TRANSCRIBE_DURATION_SECONDS) {
    throw new Error('录音时间过长，请控制在 3 分钟内');
  }
}

/** 将 Blob 转为 data URL，供 Mimo 音频理解接口消费 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('音频读取失败'));
    reader.readAsDataURL(blob);
  });
}

/** 使用 Mimo-V2-Omni 对录音 Blob 进行转写 */
export async function transcribeAudioBlob(blob: Blob, durationSeconds?: number): Promise<string> {
  validateTranscribeAudio(blob, durationSeconds);
  const audioData = await blobToDataUrl(blob);

  const response = await fetch(MIMO_TRANSCRIBE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ audioData }),
  });

  const data = await response.json() as MimoTranscribeResponse;

  if (!response.ok) {
    if (response.status === 401) throw new Error('Mimo API Key 无效，请检查服务端环境变量 MIMO_API_KEY');
    if (response.status === 429) throw new Error('Mimo 请求过于频繁，请稍后重试');
    throw new Error(data.error || `Mimo STT 错误 (${response.status})`);
  }

  return data.transcript?.trim() || '';
}

/** 启动一段浏览器录音，停止后使用 Mimo 转写 */
export async function startSTT(
  onText: STTCallback,
  onError: STTErrorCallback
): Promise<STTSession> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(chunks, { type: mimeType });

      try {
        onText('Mimo 正在转写…', false);
        const transcript = await transcribeAudioBlob(blob);
        onText(transcript, true);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Mimo 转写失败');
      }
    };

    recorder.start(100);

    return {
      stop: () => {
        if (recorder.state === 'recording') {
          recorder.stop();
        } else {
          stream.getTracks().forEach(track => track.stop());
        }
      },
    };
  } catch (err) {
    onError(`初始化失败: ${err instanceof Error ? err.message : String(err)}`);
    return { stop: () => {} };
  }
}
