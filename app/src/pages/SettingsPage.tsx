/**
 * 设置页面
 * 配置 API Key、练习模式等偏好设置
 */
import { useState, useEffect } from 'react';
import { Save, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { checkMimoHealth, type MimoHealthStatus } from '../services/mimo';
import { PageContent, PageHeader, PageShell } from '../components/ui';

export function SettingsPage() {
  const { setPage, settings, updateSettings } = useAppStore();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<MimoHealthStatus | null>(null);
  const [healthError, setHealthError] = useState('');

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async () => {
    await updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleHealthCheck = async () => {
    setHealthLoading(true);
    setHealthError('');
    try {
      const status = await checkMimoHealth();
      setHealthStatus(status);
    } catch (err) {
      setHealthStatus(null);
      setHealthError(err instanceof Error ? err.message : 'Mimo 健康检查失败');
    } finally {
      setHealthLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHeader title="设置" subtitle="Mimo 能力状态与练习偏好" backLabel="返回首页" onBack={() => setPage('home')} />

      <PageContent maxWidth="sm" className="space-y-6">

        {/* Mimo 配置 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Mimo 配置</h2>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white">小米 Mimo API</p>
              <p className="text-xs text-gray-400 mt-1">API Key 通过服务端环境变量 <code>MIMO_API_KEY</code> 配置，不会保存到浏览器。</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 text-purple-700 dark:text-purple-300">评分：mimo-v2.5-pro</div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-blue-700 dark:text-blue-300">对话：mimo-v2.5</div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-green-700 dark:text-green-300">转写：mimo-v2-omni</div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 text-orange-700 dark:text-orange-300">播报：mimo-v2.5-tts</div>
            </div>
            <button
              onClick={handleHealthCheck}
              disabled={healthLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white py-2.5 text-sm font-medium transition-colors"
            >
              {healthLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              检查 Mimo 连接
            </button>
            {healthStatus && (
              <div className={`rounded-xl border p-3 text-xs ${healthStatus.configured ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' : 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800'}`}>
                <p className="font-medium">{healthStatus.configured ? 'Mimo 代理已配置' : 'Mimo 代理未配置 API Key'}</p>
                <p className="mt-1 break-all">Base URL：{healthStatus.baseUrl}</p>
                <p className="mt-1">超时：Chat {Math.round(healthStatus.timeouts.CHAT / 1000)}s / TTS {Math.round(healthStatus.timeouts.TTS / 1000)}s / STT {Math.round(healthStatus.timeouts.TRANSCRIBE / 1000)}s</p>
              </div>
            )}
            {healthError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
                <AlertCircle size={16} />
                <span>{healthError}</span>
              </div>
            )}
          </div>
        </section>

        {/* 练习模式 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">练习模式</h2>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'normal', label: '标准', desc: '无时限', color: 'border-blue-400 bg-blue-50' },
              { value: 'stress', label: '压力', desc: '严格计时', color: 'border-red-400 bg-red-50' },
              { value: 'warmup', label: '热身', desc: '宽松时限', color: 'border-green-400 bg-green-50' },
            ] as const).map(mode => (
              <button
                key={mode.value}
                onClick={() => setForm(f => ({ ...f, practiceMode: mode.value }))}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  form.practiceMode === mode.value
                    ? mode.color
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                <p className="font-medium text-gray-800 dark:text-white text-sm">{mode.label}</p>
                <p className="text-xs text-gray-400">{mode.desc}</p>
              </button>
            ))}
          </div>
          <div className="mt-3 bg-gray-100 dark:bg-gray-700 rounded-xl p-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>🎯 <strong>标准</strong>：无时间限制，自由练习</p>
            <p>⏱️ <strong>压力</strong>：Part1=40s，Part2=120s，Part3=60s</p>
            <p>🌱 <strong>热身</strong>：准备时间延长，适合初学者</p>
          </div>
        </section>

        {/* 功能开关 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">功能开关</h2>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            <ToggleItem
              label="考官语音播报"
              desc="使用 Mimo TTS 朗读题目，模拟考场氛围"
              checked={form.enableTTS}
              onChange={v => setForm(f => ({ ...f, enableTTS: v }))}
            />
            <ToggleItem
              label="语音识别转写"
              desc="停止录音后使用 mimo-v2-omni 转为文字"
              checked={form.enableSTT}
              onChange={v => setForm(f => ({ ...f, enableSTT: v }))}
            />
          </div>
        </section>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          className={`w-full py-4 rounded-2xl font-semibold text-white transition-all ${
            saved ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {saved ? (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle size={20} />
              已保存
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Save size={20} />
              保存设置
            </span>
          )}
        </button>

        {/* 题库信息 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">题库信息</h2>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-400 mb-3">AI 能力统一使用本地 Mimo 代理，需在 app/.env 中配置 MIMO_API_KEY。</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">📚 2026年 1-4 月雅思口语题库</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                <p className="text-lg font-bold text-blue-600">27</p>
                <p className="text-xs text-gray-500">Part 1 话题</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
                <p className="text-lg font-bold text-purple-600">47</p>
                <p className="text-xs text-gray-500">Part 2&3 题</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                <p className="text-lg font-bold text-green-600">156</p>
                <p className="text-xs text-gray-500">Part 1 小题</p>
              </div>
            </div>
          </div>
        </section>
      </PageContent>
    </PageShell>
  );
}

function ToggleItem({ label, desc, checked, onChange }: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-white">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full transition-colors relative ${checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
