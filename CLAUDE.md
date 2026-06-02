# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

雅思口语练习 Web App，帮助考生练习雅思 Part 1 / Part 2 / Part 3 口语。前端纯静态应用，所有数据存储在浏览器本地。

## 常用命令

所有命令在 `app/` 目录下执行：

```bash
cd app
npm run dev      # 启动开发服务器（含 API 代理）
npm run build    # TypeScript 编译 + Vite 构建
npm run lint     # ESLint 检查
npm run preview  # 预览构建产物
```

## 架构概览

### 技术栈
- **框架**：React 19 + TypeScript + Vite
- **样式**：Tailwind CSS v4（通过 `@tailwindcss/vite` 插件）
- **状态管理**：Zustand（`src/stores/useAppStore.ts`）
- **本地持久化**：IndexedDB（通过 `idb` 库，`src/services/db.ts`）
- **路由**：无路由库，通过 `currentPage` 状态手动切换页面

### 页面结构

`App.tsx` 根据 `useAppStore` 中的 `currentPage` 状态渲染对应页面：

| 页面值 | 文件 | 功能 |
|---|---|---|
| `home` | `HomePage.tsx` | 首页，导航入口 |
| `practice-p1` | `PracticePart1Page.tsx` | Part 1 单题练习 |
| `practice-p23` | `PracticePart23Page.tsx` | Part 2/3 组合练习 |
| `exam` | `ExamPage.tsx` | 模拟完整考试流程 |
| `history` | `HistoryPage.tsx` | 练习历史记录 |
| `flashcard` | `FlashcardPage.tsx` | 薄弱话题闪卡复习 |
| `chat` | `ChatPage.tsx` | AI 考官多轮对话 |
| `settings` | `SettingsPage.tsx` | API Key 等设置 |

### 核心服务

- **`src/services/ai.ts`**：Mimo AI 服务
  - `mimo-v2.5-pro`：口语评分反馈，通过 `/api/mimo/chat` 代理
  - `mimo-v2.5`：AI 考官多轮对话与关键词提示，通过 `/api/mimo/chat` 代理
- **`src/services/stt.ts`**：语音转文字
  - 停止录音后使用 `mimo-v2-omni` 音频理解能力转写，通过 `/api/mimo/transcribe` 代理
- **`src/services/tts.ts`**：文字转语音，使用 `mimo-v2.5-tts` 合成音频并播放，通过 `/api/mimo/tts` 代理
- **`src/services/db.ts`**：IndexedDB 封装，存储练习记录（`records` 表）和设置（`settings` 表）
- **`src/services/speechStats.ts`**：语音统计（语速、停顿、填充词）

### API 代理配置

`vite.config.ts` 配置了本地 Mimo 代理（仅开发环境），避免 API Key 暴露到浏览器：
- `/api/mimo` → `http://127.0.0.1:8787`

生产部署时需要在服务器层配置同样的 `/api/mimo` 代理，并在服务端环境变量中配置 `MIMO_API_KEY`。

### 题库数据

`src/data/questions.json` 包含结构化题库，格式见 `src/types.ts` 中的 `QuestionBank` 类型：
- `part1`：必考题 / 保留题 / 旧题（每组包含话题和问题列表）
- `part23`：保留题 / 旧题（每组包含 Part 2 提示卡和 Part 3 追问）

题库由根目录的 `parse_questions.mjs` 脚本从原始文本解析生成。

### 设置与 API Key

Mimo API Key 不在浏览器设置页中录入，需通过服务端环境变量 `MIMO_API_KEY` 配置。`dashscopeApiKey` 和 `glmApiKey` 为旧版本兼容字段，不再用于主链路。
