/**
 * AI 考官多轮对话页面
 * 模拟真实雅思考官进行 Part 1 / Part 3 互动
 */
import { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Loader2, MessageSquare } from 'lucide-react';
import questionsData from '../data/questions.json';
import { useAppStore } from '../stores/useAppStore';
import { chatWithExaminer, startExaminerChat } from '../services/ai';
import { useSTT } from '../hooks/useSTT';
import { preloadSpeech as preloadMimoSpeech, retryLastSpeech, speak as speakMimo } from '../services/tts';
import { useTTSStatus } from '../hooks/useTTSStatus';
import { AIRequestStatus } from '../components/AIRequestStatus';
import { PageHeader, PageShell } from '../components/ui';
import type { ChatMessage } from '../types';

const TTS_SOURCE = 'chat';

const topics = [
  ...questionsData.part1.必考题.map(t => ({ topic: t.topic, part: 'part1' as const })),
  ...questionsData.part1.保留题.map(t => ({ topic: t.topic, part: 'part1' as const })),
  ...questionsData.part23.保留题.map(c => ({ topic: c.titleZh, part: 'part3' as const })),
];

type ChatStep = 'select' | 'chatting';

export function ChatPage() {
  const { setPage, settings } = useAppStore();
  const [step, setStep] = useState<ChatStep>('select');
  const [selectedTopic, setSelectedTopic] = useState<{ topic: string; part: 'part1' | 'part3' } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [failedMessage, setFailedMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stt = useSTT();
  const ttsStatus = useTTSStatus(TTS_SOURCE);

  /** 滚动到底部 */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /** 开始对话，让考官说第一句话 */
  const startChat = async (topic: { topic: string; part: 'part1' | 'part3' }) => {
    setSelectedTopic(topic);
    setMessages([]);
    setStep('chatting');
    setLoading(true);

    try {
      const firstQuestion = await startExaminerChat('', topic);
      const msg: ChatMessage = {
        role: 'examiner',
        content: firstQuestion,
        timestamp: Date.now(),
      };
      setMessages([msg]);
      if (settings.enableTTS) {
        preloadMimoSpeech(firstQuestion, { source: TTS_SOURCE });
        speakMimo(firstQuestion, { source: TTS_SOURCE });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '考官连接失败');
    } finally {
      setLoading(false);
    }
  };

  /** 发送用户消息 */
  const sendMessage = async (text: string) => {
    if (!text.trim() || !selectedTopic || loading) return;
    setError('');
    setFailedMessage('');

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setLoading(true);

    try {
      const reply = await chatWithExaminer(
        '',
        messages,
        text,
        selectedTopic
      );
      const examinerMsg: ChatMessage = {
        role: 'examiner',
        content: reply,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, examinerMsg]);
      if (settings.enableTTS) {
        preloadMimoSpeech(reply, { source: TTS_SOURCE });
        speakMimo(reply, { source: TTS_SOURCE });
      }
    } catch (err) {
      setFailedMessage(text);
      setError(err instanceof Error ? err.message : '发送失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  /** 切换语音输入 */
  const toggleVoiceInput = async () => {
    if (stt.isListening) {
      // 停止后由 useEffect 监听 isListening 变化统一填入转写结果，避免竞态
      stt.stopListening();
    } else {
      stt.clearTranscript();
      setInputText('');
      await stt.startListening();
    }
  };

  // Mimo 转写完成后将最终文本填入输入框
  useEffect(() => {
    if (!stt.isListening && !stt.isTranscribing && stt.transcript) {
      setInputText(stt.transcript);
    }
  }, [stt.isListening, stt.isTranscribing, stt.transcript]);

  const [partFilter, setPartFilter] = useState<'part1' | 'part3' | 'all'>('all');

  const filteredTopics = partFilter === 'all' ? topics : topics.filter(t => t.part === partFilter);

  return (
    <PageShell className="flex flex-col">
      <PageHeader
        title={step === 'select' ? 'AI 考官对话' : selectedTopic?.topic || 'AI 考官对话'}
        subtitle="多轮追问训练"
        backLabel={step === 'select' ? '返回首页' : '返回话题'}
        onBack={() => step === 'select' ? setPage('home') : setStep('select')}
      />

      {/* ===== 话题选择 ===== */}
      {step === 'select' && (
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl p-4 mb-4 text-sm">
            AI 考官、语音转写与语音播报均由服务端 Mimo 代理提供，请确保已配置 MIMO_API_KEY。
          </div>

          <div className="flex gap-2 mb-4">
            {(['all', 'part1', 'part3'] as const).map(f => (
              <button key={f} onClick={() => setPartFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  partFilter === f ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'
                }`}>
                {f === 'all' ? '全部' : f.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="grid gap-2">
            {filteredTopics.map((topic, i) => (
              <button key={i} onClick={() => startChat(topic)}
                className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left">
                <div>
                  <p className="font-medium text-gray-800 dark:text-white text-sm">{topic.topic}</p>
                  <p className="text-xs text-gray-400">{topic.part === 'part1' ? 'Part 1 日常问答' : 'Part 3 深度追问'}</p>
                </div>
                <MessageSquare size={16} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== 对话界面 ===== */}
      {step === 'chatting' && (
        <>
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl mx-auto w-full">
            {ttsStatus.status === 'loading' && <AIRequestStatus type="loading" message={ttsStatus.message} />}
            {ttsStatus.status === 'playing' && <AIRequestStatus type="speaking" message={ttsStatus.message} />}
            {ttsStatus.status === 'error' && <AIRequestStatus type="error" message={ttsStatus.message} actionLabel="重试" onAction={retryLastSpeech} />}
            {stt.isTranscribing && <AIRequestStatus type="transcribing" message="Mimo 正在转写你的语音输入…" />}
            {loading && <AIRequestStatus type="thinking" message="Mimo 考官正在思考回复…" />}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'examiner' && (
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0 mt-1">
                    考
                  </div>
                )}
                <div className={`max-w-xs md:max-w-md rounded-2xl px-4 py-3 ${
                  msg.role === 'examiner'
                    ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-tl-sm'
                    : 'bg-blue-500 text-white rounded-tr-sm'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0">
                  考
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <AIRequestStatus
                type="error"
                message={error}
                actionLabel={failedMessage ? '重新发送' : undefined}
                onAction={failedMessage ? () => sendMessage(failedMessage) : undefined}
              />
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 输入栏 */}
          <div className="sticky bottom-0 bg-white/95 dark:bg-gray-800/95 border-t border-gray-200 dark:border-gray-700 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur max-w-2xl mx-auto w-full">
            {/* 语音输入状态 */}
            {(stt.isListening || stt.isTranscribing) && (
              <p className="text-xs text-blue-500 mb-2 px-1">
                {stt.interimTranscript || (stt.isListening ? '录音中，停止后将用 Mimo 转写…' : 'Mimo 正在转写…')}
              </p>
            )}

            <div className="flex items-end gap-2">
              <textarea
                name="answer"
                aria-label="输入你的回答"
                autoComplete="off"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(inputText);
                  }
                }}
                placeholder="输入你的回答…"
                rows={2}
                className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              />
              <button
                type="button"
                aria-label={stt.isListening ? '停止语音输入' : '开始语音输入'}
                onClick={toggleVoiceInput}
                className={`p-3 rounded-xl transition-colors ${
                  stt.isListening
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {stt.isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button
                type="button"
                aria-label="发送回答"
                onClick={() => sendMessage(inputText)}
                disabled={!inputText.trim() || loading}
                className="p-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
