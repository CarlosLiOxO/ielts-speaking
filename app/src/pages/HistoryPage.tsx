/**
 * 历史记录页面
 * 展示练习记录、支持回放录音和与昨天对比
 */
import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Mic, Calendar, Flag, Trash2 } from 'lucide-react';
import { getAllRecords, deleteRecord, toggleWeakRecord, getYesterdayRecord } from '../services/db';
import { useAppStore } from '../stores/useAppStore';
import type { PracticeRecord } from '../types';
import { IconButton, PageHeader, PageShell, SegmentedFilter } from '../components/ui';
import { getSpeechRateEvaluation } from '../services/speechStats';

const shortDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
});

const detailDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function HistoryPage() {
  const { setPage } = useAppStore();
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<PracticeRecord | null>(null);
  const [yesterdayRecord, setYesterdayRecord] = useState<PracticeRecord | null>(null);
  const [filter, setFilter] = useState<'all' | 'part1' | 'part2' | 'part3'>('all');
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 跟踪当前 Audio URL，确保切换或卸载时能及时释放
  const audioUrlRef = useRef<string | null>(null);

  // 供 handleDelete / handleToggleWeak 调用的刷新函数
  const loadRecords = async () => {
    setLoading(true);
    const all = await getAllRecords();
    setRecords(all);
    setLoading(false);
  };

  useEffect(() => {
    // 用 .then() 异步回调设置状态，避免在 effect 体内同步调用 setState
    getAllRecords().then(all => {
      setRecords(all);
      setLoading(false);
    });
    // 组件卸载时停止播放并释放音频资源
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  /** 选中记录并加载昨天对比 */
  const selectRecord = async (record: PracticeRecord) => {
    setSelectedRecord(record);
    const yesterday = await getYesterdayRecord(record.topicOrTitle);
    setYesterdayRecord(yesterday);
  };

  /** 播放/暂停录音 */
  const togglePlay = (record: PracticeRecord) => {
    if (!record.audioBlob) return;

    if (playingId === record.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      // 切换到新录音时，释放上一个 URL
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    }

    const url = URL.createObjectURL(record.audioBlob);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlayingId(record.id!);
    audio.onended = () => {
      setPlayingId(null);
      URL.revokeObjectURL(url);
      audioUrlRef.current = null;
    };
  };

  /** 删除记录 */
  const handleDelete = async (id: number) => {
    const confirmed = window.confirm('确定要删除这条练习记录吗？删除后无法恢复。');
    if (!confirmed) return;
    await deleteRecord(id);
    await loadRecords();
    if (selectedRecord?.id === id) setSelectedRecord(null);
  };

  /** 标记薄弱 */
  const handleToggleWeak = async (record: PracticeRecord) => {
    await toggleWeakRecord(record.id!, !record.isWeak);
    await loadRecords();
  };

  const filteredRecords = filter === 'all' ? records : records.filter(r => r.part === filter);

  const partLabel = (part: string) => ({ part1: 'P1', part2: 'P2', part3: 'P3', exam: '考试' }[part] || part);
  const partColor = (part: string) => ({
    part1: 'bg-blue-100 text-blue-600',
    part2: 'bg-purple-100 text-purple-600',
    part3: 'bg-green-100 text-green-600',
    exam: 'bg-orange-100 text-orange-600',
  }[part] || '');

  return (
    <PageShell className="flex flex-col">
      <PageHeader title="复盘中心" subtitle={`${records.length} 条练习记录`} backLabel="返回首页" onBack={() => setPage('home')} />

      <div className="border-b border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl">
          <SegmentedFilter
            label="历史记录筛选"
            value={filter}
            onChange={(next) => setFilter(next as typeof filter)}
            options={[
              { value: 'all', label: '全部' },
              { value: 'part1', label: 'Part 1' },
              { value: 'part2', label: 'Part 2' },
              { value: 'part3', label: 'Part 3' },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 记录列表 */}
        <div className={`${selectedRecord ? 'hidden md:flex' : 'flex'} flex-col flex-1 overflow-y-auto`}>
          {loading ? (
            <div className="p-8 text-center text-gray-400">加载中…</div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Mic size={40} className="mx-auto mb-3 opacity-30" />
              <p>还没有练习记录</p>
              <p className="text-sm mt-1">完成第一次练习后会出现在这里</p>
            </div>
          ) : (
            <div className="p-3 grid gap-2 max-w-2xl mx-auto w-full">
              {filteredRecords.map(record => (
                <button
                  key={record.id}
                  onClick={() => selectRecord(record)}
                  className={`text-left bg-white dark:bg-gray-800 rounded-xl p-4 border transition-colors ${
                    selectedRecord?.id === record.id
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${partColor(record.part)}`}>
                          {partLabel(record.part)}
                        </span>
                        {record.isWeak && (
                          <span className="text-xs bg-orange-100 text-orange-500 px-2 py-0.5 rounded-full">薄弱</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{record.topicOrTitle}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{record.question}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">{shortDateFormatter.format(new Date(record.date))}</p>
                      <p className="text-xs text-gray-400">{Math.round(record.duration)}s</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 详情面板 */}
        {selectedRecord && (
          <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 md:max-w-md">
            <div className="p-4">
              {/* 顶部操作 */}
              <div className="flex items-center justify-between mb-4">
                <div className="md:hidden">
                  <IconButton label="返回记录列表" onClick={() => setSelectedRecord(null)} icon={<Calendar size={20} aria-hidden="true" />} />
                </div>
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    aria-label={selectedRecord.isWeak ? '取消薄弱标记' : '标记为薄弱'}
                    onClick={() => handleToggleWeak(selectedRecord)}
                    className={`flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors ${
                      selectedRecord.isWeak ? 'bg-orange-100 text-orange-500' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Flag size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="删除练习记录"
                    onClick={() => handleDelete(selectedRecord.id!)}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* 基本信息 */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${partColor(selectedRecord.part)}`}>
                    {selectedRecord.part.toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-500">
                    {detailDateFormatter.format(new Date(selectedRecord.date))}
                  </span>
                </div>
                <p className="font-medium text-gray-800 dark:text-white">{selectedRecord.topicOrTitle}</p>
                <p className="text-sm text-gray-500 mt-1">{selectedRecord.question}</p>
              </div>

              {/* 语音统计 */}
              <div className="grid grid-cols-4 gap-2 bg-gray-50 dark:bg-gray-700 rounded-xl p-3 mb-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500">时长</p>
                  <p className="text-sm font-semibold">{Math.round(selectedRecord.duration)}s</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">单词</p>
                  <p className="text-sm font-semibold">{selectedRecord.wordCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">语速</p>
                  <p className={`text-sm font-semibold ${getSpeechRateEvaluation(selectedRecord.speechRate).color}`}>
                    {selectedRecord.speechRate}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">停顿</p>
                  <p className="text-sm font-semibold">{selectedRecord.pauseCount}</p>
                </div>
              </div>

              {/* 录音回放 */}
              {selectedRecord.audioBlob && (
                <div className="mb-4">
                  <button
                    onClick={() => togglePlay(selectedRecord)}
                    className={`flex items-center gap-2 w-full py-3 rounded-xl font-medium transition-colors ${
                      playingId === selectedRecord.id
                        ? 'bg-gray-700 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {playingId === selectedRecord.id ? <Pause size={18} /> : <Play size={18} />}
                    {playingId === selectedRecord.id ? '暂停回放' : '播放录音'}
                  </button>
                </div>
              )}

              {/* 转写文本 */}
              {selectedRecord.transcript && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">转写文本</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                    {selectedRecord.transcript}
                  </p>
                </div>
              )}

              {/* AI 反馈 */}
              {selectedRecord.aiFeedback && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">AI 反馈</p>
                  <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 whitespace-pre-line">
                    {selectedRecord.aiFeedback}
                  </div>
                </div>
              )}

              {/* 昨日对比 */}
              {yesterdayRecord && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={14} className="text-blue-500" />
                    <span className="text-xs font-semibold text-blue-600">与昨天对比</span>
                  </div>
                  <CompareRow label="语速(wpm)" today={selectedRecord.speechRate} yesterday={yesterdayRecord.speechRate} higherBetter />
                  <CompareRow label="单词数" today={selectedRecord.wordCount} yesterday={yesterdayRecord.wordCount} higherBetter />
                  <CompareRow label="时长(s)" today={Math.round(selectedRecord.duration)} yesterday={Math.round(yesterdayRecord.duration)} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function CompareRow({ label, today, yesterday, higherBetter }: {
  label: string;
  today: number;
  yesterday: number;
  higherBetter?: boolean;
}) {
  const diff = today - yesterday;
  const improved = higherBetter ? diff > 0 : diff < 0;
  const diffStr = diff > 0 ? `+${diff}` : String(diff);

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-blue-100 dark:border-blue-800 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">昨天 {yesterday}</span>
        <span className="text-xs font-semibold text-gray-800 dark:text-white">今天 {today}</span>
        {diff !== 0 && (
          <span className={`text-xs font-medium ${improved ? 'text-green-500' : 'text-red-400'}`}>
            {diffStr}
          </span>
        )}
      </div>
    </div>
  );
}
