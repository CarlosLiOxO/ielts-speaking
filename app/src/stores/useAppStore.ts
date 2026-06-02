/**
 * 全局应用状态（Zustand）
 */
import { create } from 'zustand';
import type { AppSettings, PracticeMode } from '../types';
import { loadSettings, saveSettings } from '../services/db';

interface AppState {
  // 设置
  settings: AppSettings;
  settingsLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;

  // 当前导航页面
  currentPage: PageName;
  setPage: (page: PageName) => void;

  // 练习模式
  practiceMode: PracticeMode;
  setPracticeMode: (mode: PracticeMode) => void;

  // 每日一题索引（基于日期固定）
  dailyIndex: number;
}

export type PageName =
  | 'home'
  | 'browse'
  | 'practice-p1'
  | 'practice-p23'
  | 'exam'
  | 'history'
  | 'flashcard'
  | 'chat'
  | 'settings';

/** 根据日期生成固定的随机索引 */
function getDailyIndex(max: number): number {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return seed % max;
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: {
    dashscopeApiKey: '',
    glmApiKey: '',
    practiceMode: 'normal',
    enableTTS: true,
    enableSTT: true,
  },
  settingsLoaded: false,

  /** 从 IndexedDB 加载设置 */
  loadSettings: async () => {
    const settings = await loadSettings();
    set({ settings, settingsLoaded: true });
  },

  /** 更新并持久化设置 */
  updateSettings: async (partial) => {
    const newSettings = { ...get().settings, ...partial };
    set({ settings: newSettings });
    await saveSettings(newSettings);
  },

  currentPage: 'home',
  setPage: (page) => set({ currentPage: page }),

  practiceMode: 'normal',
  setPracticeMode: (mode) => set({ practiceMode: mode }),

  dailyIndex: getDailyIndex(100),
}));
