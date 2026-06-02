/**
 * 首页
 * 今日练习仪表盘、每日题目和主要练习入口
 */
import { useState, useEffect } from 'react';
import { Mic, BookOpen, Brain, History, CreditCard, MessageSquare, Settings, Play, Zap, Leaf, Target, ArrowRight } from 'lucide-react';
import questionsData from '../data/questions.json';
import { useAppStore } from '../stores/useAppStore';
import { getTodayRecords } from '../services/db';
import { IconButton, MetricCard, PageContent, PageShell, AppButton } from '../components/ui';
import type { PracticeRecord } from '../types';

const allPart1Topics = [
  ...questionsData.part1.必考题,
  ...questionsData.part1.保留题,
];

export function HomePage() {
  const { setPage, dailyIndex, settings } = useAppStore();
  const [todayRecords, setTodayRecords] = useState<PracticeRecord[]>([]);

  const dailyTopic = allPart1Topics[dailyIndex % allPart1Topics.length];
  const dailyQuestion = dailyTopic?.questions[0];
  const dailyCard = questionsData.part23.保留题[dailyIndex % questionsData.part23.保留题.length];

  useEffect(() => {
    getTodayRecords().then(setTodayRecords);
  }, []);

  const todayStats = {
    count: todayRecords.length,
    totalTime: Math.round(todayRecords.reduce((sum, r) => sum + r.duration, 0) / 60),
    feedbackCount: todayRecords.filter(record => record.aiFeedback).length,
  };

  const modeIcon = settings.practiceMode === 'stress' ? <Zap size={14} className="text-red-500" /> :
                   settings.practiceMode === 'warmup' ? <Leaf size={14} className="text-green-500" /> :
                   <Mic size={14} className="text-blue-500" />;

  const modeLabel = { normal: '标准', stress: '压力', warmup: '热身' }[settings.practiceMode];
  const nextGoal = todayStats.count === 0 ? '先完成 1 次短答练习' : todayStats.count < 3 ? '再完成 2 次追问训练' : '今天状态不错，去复盘薄弱题';

  return (
    <PageShell className="pb-20">
      <section className="bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 text-white">
        <PageContent maxWidth="lg" className="pt-[calc(2.75rem+env(safe-area-inset-top))] pb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-blue-100">
                {modeIcon}
                {modeLabel}模式
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">今天练哪一题？</h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-blue-100">围绕雅思口语 Part 1、Part 2 和 Part 3，完成听题、录音、转写、AI 反馈和复盘。</p>
            </div>
            <IconButton
              icon={<Settings size={18} aria-hidden="true" />}
              label="打开设置"
              onClick={() => setPage('settings')}
              className="bg-white/15 text-white hover:bg-white/25 hover:text-white"
            />
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3">
            <MetricCard value={todayStats.count} label="今日练习" unit="次" tone="blue" />
            <MetricCard value={todayStats.totalTime} label="累计时长" unit="分" tone="green" />
            <MetricCard value={todayStats.feedbackCount} label="AI 反馈" unit="份" tone="purple" />
          </div>
        </PageContent>
      </section>

      <PageContent maxWidth="lg" className="-mt-5 space-y-5">
        <section className="rounded-[24px] border border-white/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.10)] dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-200">
              <Target size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">今日目标</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{nextGoal}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">建议先完成每日 Part 1，再用 Part 2/3 做长回答结构训练。</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AppButton onClick={() => setPage('practice-p1')} size="lg" className="w-full">
              <Play size={18} aria-hidden="true" />
              开始每日一题
            </AppButton>
            <AppButton onClick={() => setPage('history')} variant="secondary" size="lg" className="w-full">
              <History size={18} aria-hidden="true" />
              查看复盘记录
            </AppButton>
          </div>
        </section>

        {dailyQuestion && (
          <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">每日 Part 1</span>
              <span className="truncate text-xs text-slate-400">{dailyTopic.topic}</span>
            </div>
            <p className="text-base font-medium leading-relaxed text-slate-900 dark:text-white">{dailyQuestion.question}</p>
            <div className="mt-4 flex gap-3">
              <AppButton onClick={() => setPage('practice-p1')} className="flex-1">
                练习这道题
                <ArrowRight size={16} aria-hidden="true" />
              </AppButton>
              <AppButton onClick={() => setPage('flashcard')} variant="secondary">
                参考思路
              </AppButton>
            </div>
          </section>
        )}

        {dailyCard?.part2 && (
          <section className="rounded-[20px] border border-purple-200 bg-purple-50 p-5 dark:border-purple-800 dark:bg-purple-900/20">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-900/50 dark:text-purple-200">今日 Part 2</span>
            </div>
            <p className="line-clamp-3 text-base font-medium leading-relaxed text-slate-900 dark:text-white">{dailyCard.part2.prompt}</p>
            <AppButton onClick={() => setPage('practice-p23')} className="mt-4 w-full bg-purple-500 hover:bg-purple-600">
              <BookOpen size={18} aria-hidden="true" />
              练习 Part 2 & 3
            </AppButton>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-500">练习入口</h2>
            <span className="text-xs text-slate-400">移动端优先 · 快速进入</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <NavCard icon={<Mic size={24} className="text-blue-500" />} title="Part 1" desc="短答训练" color="bg-blue-50 dark:bg-blue-900/20" onClick={() => setPage('practice-p1')} />
            <NavCard icon={<BookOpen size={24} className="text-purple-500" />} title="Part 2 & 3" desc="独白追问" color="bg-purple-50 dark:bg-purple-900/20" onClick={() => setPage('practice-p23')} />
            <NavCard icon={<Brain size={24} className="text-orange-500" />} title="模拟考试" desc="完整流程" color="bg-orange-50 dark:bg-orange-900/20" onClick={() => setPage('exam')} />
            <NavCard icon={<MessageSquare size={24} className="text-emerald-500" />} title="AI 考官" desc="多轮对话" color="bg-emerald-50 dark:bg-emerald-900/20" onClick={() => setPage('chat')} />
            <NavCard icon={<CreditCard size={24} className="text-indigo-500" />} title="闪卡复习" desc="快速巩固" color="bg-indigo-50 dark:bg-indigo-900/20" onClick={() => setPage('flashcard')} />
            <NavCard icon={<History size={24} className="text-slate-500" />} title="复盘中心" desc="历史反馈" color="bg-slate-100 dark:bg-slate-800" onClick={() => setPage('history')} />
          </div>
        </section>
      </PageContent>
    </PageShell>
  );
}

function NavCard({ icon, title, desc, color, onClick }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${color} min-h-[116px] rounded-[20px] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]`}
    >
      <div className="mb-3">{icon}</div>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{desc}</p>
    </button>
  );
}
