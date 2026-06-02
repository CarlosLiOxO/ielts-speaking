/**
 * 主应用入口
 * 管理页面路由和全局设置加载
 */
import { lazy, Suspense, useEffect } from 'react';
import { useAppStore } from './stores/useAppStore';
import { HomePage } from './pages/HomePage';

const PracticePart1Page = lazy(() => import('./pages/PracticePart1Page').then(module => ({ default: module.PracticePart1Page })));
const PracticePart23Page = lazy(() => import('./pages/PracticePart23Page').then(module => ({ default: module.PracticePart23Page })));
const ExamPage = lazy(() => import('./pages/ExamPage').then(module => ({ default: module.ExamPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(module => ({ default: module.HistoryPage })));
const FlashcardPage = lazy(() => import('./pages/FlashcardPage').then(module => ({ default: module.FlashcardPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then(module => ({ default: module.ChatPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));

function AppLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">加载中…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { currentPage, settingsLoaded, loadSettings } = useAppStore();

  // 应用启动时加载持久化设置
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (!settingsLoaded) {
    return <AppLoading />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Suspense fallback={<AppLoading />}>
        {currentPage === 'home' && <HomePage />}
        {currentPage === 'practice-p1' && <PracticePart1Page />}
        {currentPage === 'practice-p23' && <PracticePart23Page />}
        {currentPage === 'exam' && <ExamPage />}
        {currentPage === 'history' && <HistoryPage />}
        {currentPage === 'flashcard' && <FlashcardPage />}
        {currentPage === 'chat' && <ChatPage />}
        {currentPage === 'settings' && <SettingsPage />}
      </Suspense>
    </div>
  );
}
