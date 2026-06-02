# 雅思口语练习 App — 产品规格说明（Spec）

> 版本：v1.1 | 更新日期：2026-04-15

---

## 1. 产品概述

**目标用户**：备考雅思的中国考生  
**核心价值**：在没有真人考官的情况下，通过 AI 辅助完成高度贴近真实考试的口语练习  
**部署形式**：前端 Web App + 本地/服务端 Mimo API 代理，数据本地存储，AI Key 不进入浏览器

---

## 2. 功能模块

### 2.1 Part 1 练习（`PracticePart1Page`）

| 功能点 | 状态 | 描述 |
|--------|------|------|
| 话题列表 + 分类筛选 | ✅ | 必考题 / 保留题 / 旧题三分类 |
| 随机抽题 | ✅ | Fisher-Yates 洗牌，均匀随机 |
| 每日一题 | ✅ | 基于日期 seed 固定索引 |
| 题目 TTS 播报 | ✅ | Mimo TTS 音频合成，支持内存缓存、题目预加载、失败重试与页面级 source 状态隔离 |
| 录音 + 停止后 STT 转写 | ✅ | 使用 `mimo-v2-omni` 进行录音后音频转写，支持大小/时长保护与失败重试 |
| AI 评分反馈（Mimo） | ✅ | `mimo-v2.5-pro` 四维度雅思评分，可展开/收起，支持失败重试并回写历史记录 |
| 参考答案 | ✅ | 折叠展示 |
| 薄弱话题标记 | ✅ | 本地 session 状态，不持久化 |
| 练习记录自动保存 | ✅ | IndexedDB 持久化 |

**已知限制**：薄弱话题标记仅在当前 session 有效，刷新后丢失（持久化见 §6.1）

---

### 2.2 Part 2 & 3 练习（`PracticePart23Page`）

| 功能点 | 状态 | 描述 |
|--------|------|------|
| 卡片列表 + 筛选（保留题/旧题） | ✅ | |
| 随机选题 | ✅ | |
| 1 分钟准备计时（热身模式 2 分钟） | ✅ | |
| AI 关键词提示（Mimo） | ✅ | `mimo-v2.5` 生成 5 个备考关键词，失败时静默跳过 |
| Part 2 独白录音 + STT | ✅ | 停止录音后用 `mimo-v2-omni` 转写 |
| Part 3 追问多题切换 | ✅ | |
| AI 评分反馈 | ✅ | |
| 参考答案 | ✅ | |

---

### 2.3 模拟考试（`ExamPage`）

| 功能点 | 状态 | 描述 |
|--------|------|------|
| 完整 Part 1 → Part 2 → Part 3 流程 | ✅ | |
| 随机组卷（Part 1 × 2 话题，各 3 题）| ✅ | Fisher-Yates 洗牌 |
| 压力模式限时 | ✅ | P1=40s / P2=120s / P3=60s |
| 进度条 | ✅ | |
| 全程录音保存 | ✅ | |

---

### 2.4 AI 考官对话（`ChatPage`）

| 功能点 | 状态 | 描述 |
|--------|------|------|
| 话题选择（Part 1 / Part 3） | ✅ | |
| 考官开场白（自动发起） | ✅ | `mimo-v2.5` 驱动 |
| 多轮对话 | ✅ | 历史消息拼接上下文 |
| 语音输入（STT） | ✅ | 停止录音后用 `mimo-v2-omni` 转写并填入输入框 |
| 考官回复 TTS 播报 | ✅ | `mimo-v2.5-tts` 合成播放，复用 TTS 缓存 |
| API 错误友好提示（401/429） | ✅ | |

---

### 2.5 练习历史（`HistoryPage`）

| 功能点 | 状态 | 描述 |
|--------|------|------|
| 全部记录列表（按时间倒序） | ✅ | |
| Part 类型筛选 | ✅ | |
| 录音回放（含切换/卸载资源释放） | ✅ | |
| 转写文本展示 | ✅ | |
| AI 反馈展示 | ✅ | |
| 昨日同话题对比 | ✅ | 语速 / 单词数 / 时长对比 |
| 薄弱标记 / 删除 | ✅ | |
| 今日记录统计（首页使用） | ✅ | IDBKeyRange 范围查询，修复后准确 |

---

### 2.6 闪卡模式（`FlashcardPage`）

| 功能点 | 状态 | 描述 |
|--------|------|------|
| 随机展示薄弱话题题目 | ✅ | Fisher-Yates 洗牌 |
| 翻卡看答案 | ✅ | |

---

### 2.7 设置（`SettingsPage`）

| 设置项 | 描述 |
|--------|------|
| Mimo API Key | 通过服务端环境变量配置，驱动评分、对话、关键词、TTS、STT |
| Mimo 健康检查 | 设置页可检查代理是否启动、API Key 是否配置、Base URL 和超时配置 |
| UI/UX 基础 | 中文元信息、统一视觉 tokens、统一页面骨架/按钮/筛选器/题目卡、今日练习仪表盘、录音状态中心、AI 评分报告卡、移动端安全区与触控适配、状态播报、闪卡键盘操作、历史删除确认 |
| Mimo 模型分工 | 评分 / 对话 / 转写 / TTS 使用固定默认模型 |
| 练习模式 | 标准 / 压力 / 热身 |
| TTS 开关 | 考官语音播报 |
| STT 开关 | 停止录音后音频转写 |

---

## 3. 技术架构

### 3.1 技术栈

| 层次 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 19 |
| 语言 | TypeScript | 5.x |
| 构建 | Vite | 8.x |
| 样式 | Tailwind CSS v4 | via `@tailwindcss/vite` |
| 状态管理 | Zustand | - |
| UI 基础 | 移动优先、全局设计 tokens、可见焦点态、触控优化、异步状态 aria-live | - |
| 本地持久化 | IndexedDB（idb 库） | - |
| 图标 | lucide-react | - |

### 3.2 AI 服务

| 服务 | 用途 | 模型 | 代理路径 |
|------|------|------|----------|
| Mimo 文本生成 | 口语评分反馈 | `mimo-v2.5-pro` | `/api/mimo/chat` |
| Mimo 文本生成 | 考官多轮对话 / 关键词提示 | `mimo-v2.5` | `/api/mimo/chat` |
| Mimo 音频理解 | 停止录音后语音转文字 | `mimo-v2-omni` | `/api/mimo/transcribe` |
| Mimo 高阶分析 | 复杂考试总结 / 多模态预留 | `mimo-v2-pro` / `mimo-v2-omni` | `/api/mimo/chat` |
| Mimo TTS | 考官语音播报（含内存缓存与预加载） | `mimo-v2.5-tts` / `mimo-v2-tts` | `/api/mimo/tts` |
| Mimo 音色扩展 | 音色设计 / 音色克隆 | `mimo-v2.5-tts-voicedesign` / `mimo-v2.5-tts-voiceclone` | `/api/mimo/tts` |

### 3.3 数据存储（IndexedDB）

| 表 | Key | 索引 | 存储内容 |
|----|-----|------|----------|
| `records` | `id`（自增） | `by-date`, `by-part`, `by-topic` | 练习记录 + 录音 Blob |
| `settings` | `key` | - | API Key、练习偏好 |

### 3.4 页面路由

通过 Zustand `currentPage` 状态手动切换，无路由库；除首页外页面使用 React.lazy 懒加载拆分首屏包体。

| `currentPage` 值 | 页面文件 |
|-----------------|---------|
| `home` | `HomePage.tsx` |
| `practice-p1` | `PracticePart1Page.tsx` |
| `practice-p23` | `PracticePart23Page.tsx` |
| `exam` | `ExamPage.tsx` |
| `history` | `HistoryPage.tsx` |
| `flashcard` | `FlashcardPage.tsx` |
| `chat` | `ChatPage.tsx` |
| `settings` | `SettingsPage.tsx` |

### 3.5 生产部署

- `npm run build` 输出到 `app/dist/`
- 开发环境需要同时启动 Vite 和本地 Mimo API 代理服务
- 需要在服务器层配置 API 反向代理（见 `nginx.conf.example`）
  - `/api/mimo/*` → 本地 Node Mimo 代理
- Mimo API Key 通过服务端环境变量提供，不进入浏览器
- Mimo 代理内置请求超时：Chat 30s、TTS 45s、STT 60s，可通过环境变量覆盖
- Mimo 代理输出 requestId、路由、模型、耗时、超时配置和错误摘要，不记录密钥、音频 Base64 或完整用户内容
- STT 采用录音结束后转写，不再依赖实时 WebSocket STT

---

## 4. 题库数据

**文件**：`app/src/data/questions.json`（由 `parse_questions.mjs` 从原始文本生成）

| 分类 | 数量 |
|------|------|
| Part 1 必考题话题 | ~16 个 |
| Part 1 保留题话题 | ~11 个 |
| Part 1 旧题话题 | 若干 |
| Part 2&3 保留题卡片 | ~47 张 |
| Part 2&3 旧题卡片 | 若干 |

**题库版本**：2026 年 1–4 月雅思口语题库

**更新方式**：修改原始文本文件 → 重新运行 `parse_questions.mjs` → 覆盖 `questions.json`

---

## 5. 代码质量现状（v1.0 修复后）

### 5.1 已修复问题列表

| 编号 | 位置 | 问题 | 状态 |
|------|------|------|------|
| C1 | `nginx.conf.example` | 生产 API 代理配置缺失 | ✅ 已补充配置文件 |
| C2 | `ExamPage.tsx` | `sort(() => Math.random())` 洗牌分布不均 | ✅ 换为 Fisher-Yates |
| C3 | `useSTT.ts` | `stopListening` 闭包捕获过期 `interimTranscript` | ✅ 改用 ref |
| C4 | `HistoryPage.tsx` | 音频 `URL.createObjectURL` 内存泄露 | ✅ 添加 ref 追踪 + cleanup |
| H1 | `stt.ts` | WebSocket 意外断开无错误通知 | ✅ 添加 `onclose` + `cleaned` 标志 |
| H2 | `ai.ts` | API 错误类型无区分 | ✅ 区分 401/429/其他 |
| H3 | `db.ts` | `getTodayRecords` 日期查询逻辑错误 | ✅ 改用 `IDBKeyRange.bound` |
| H4 | `RecorderPanel.tsx` | hooks 依赖数组问题 | ✅ ref 模式修复 |
| M2 | `ExamPage.tsx` | `as Part23Card` 强制类型转换 | ✅ 类型谓词过滤 |
| M3 | `db.ts` | 冗余 `as Promise<number>` 转换 | ✅ 移除 |
| M5 | `ChatPage.tsx` | STT 转写竞态双写 `inputText` | ✅ 统一 `useEffect` 处理 |
| Q1 | `stt.ts` | Web Speech API `any` 类型 | ✅ 定义完整接口 |
| Q4 | `AIFeedbackPanel.tsx` | Markdown 行内粗体渲染缺陷 | ✅ 正则拆分渲染 |
| L3 | `PracticePart23Page.tsx` | 关键词提示错误静默吞掉 | ✅ `console.warn` |
| - | `Timer.tsx` | render 期间写 ref（React 19 错误） | ✅ 改为 `useEffect` |
| - | `Timer.tsx` | `useEffect` 内同步 `setState`（React 19 规则） | ✅ render 阶段状态比较 |
| - | `RecorderPanel.tsx` | render 期间调用 `Math.random()`（不纯函数） | ✅ 改为固定高度数组 |
| - | `HistoryPage.tsx` | `useEffect` 内同步 `setState` | ✅ 改用 `.then()` 回调 |
| - | `PracticePart1Page.tsx` | `startPractice` 先使用后声明 | ✅ 提前声明 + `useCallback` |

### 5.2 代码健康度

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| ESLint 错误 | 3 | **0** |
| ESLint 警告 | ~15 | **0** |
| TypeScript 编译错误 | 0 | 0 |
| 构建状态 | ✅ | ✅ |

---

## 6. UI / 响应式设计规范

### 6.1 布局约束

| 场景 | 规则 |
|------|------|
| **移动端（< 768px）** | 默认全宽，`px-4` 内边距 |
| **桌面端（≥ 768px）** | 内容区最大宽度约束，居中显示 |

各页面 `max-width` 规范：

| 页面 | 内容 max-width |
|------|---------------|
| `HomePage` | `max-w-3xl`（768px 主内容 + 头部） |
| `PracticePart1Page` | `max-w-2xl` |
| `PracticePart23Page` | `max-w-2xl` |
| `ExamPage` | `max-w-2xl` |
| `ChatPage` | `max-w-2xl` |
| `HistoryPage` | `max-w-2xl`（列表） + `md:max-w-md`（详情面板） |
| `FlashcardPage` | `max-w-lg` |
| `SettingsPage` | `max-w-lg` |

### 6.2 响应式网格

- `HomePage` 功能入口网格：`grid-cols-2 md:grid-cols-3`（手机 2 列 / 桌面 3 列）
- 其他列表页保持单列，不做多列展开

---

## 7. 待办功能与优化（Backlog）

### 6.1 核心功能补全（高优先级）

| 功能 | 说明 |
|------|------|
| **薄弱话题标记持久化** | 当前 `PracticePart1Page` 标记仅存 session，需写入 IndexedDB |
| **题库版本更新机制** | 每季度题库变化时的更新流程与提示 |
| **离线缓存（PWA）** | Service Worker 缓存静态资源，支持无网练习 |

### 6.2 练习体验增强（中优先级）

| 功能 | 说明 |
|------|------|
| **Mimo STT 转写状态优化** | 停止录音后展示上传/转写进度与失败重试入口 |
| **AI 反馈历史保存** | `saveRecord` 后回写 `aiFeedback` 字段到 IndexedDB |
| **Part 1 按话题组浏览模式** | 目前只有列表，增加"查看全部小题"展开功能 |
| **练习统计页** | 周/月维度的练习频率、语速趋势、高频薄弱话题图表 |
| **考试结束总结页** | 模拟考试后展示各 Part 统计，而非直接跳转历史 |

### 6.3 AI 能力升级（中优先级）

| 功能 | 说明 |
|------|------|
| **流式评分输出** | 用 Mimo 流式接口接收评分回复，减少等待感 |
| **AI 针对性追问** | 考官对话中根据考生回答质量调整追问深度 |
| **音色设计与克隆完善** | 完整接入 `mimo-v2.5-tts-voicedesign` 与 `mimo-v2.5-tts-voiceclone` 的素材管理 |

### 6.4 工程与部署（低优先级）

| 功能 | 说明 |
|------|------|
| **Docker 部署配置** | `Dockerfile` + `nginx.conf`，方便一键部署 |
| **题库 CMS** | 不依赖脚本，通过界面或 JSON 文件快速更新题库 |
| **错误边界组件** | 全局 `ErrorBoundary`，防止单页崩溃影响整个 App |
| **API 请求超时与重试** | 统一为 AI API 调用添加 10s 超时和 1 次重试 |

---

## 8. 开发规范

### 8.1 代码规范

- 每个函数添加中文函数级注释
- 新增非小改动后执行 `npm run build` 验证无编译错误
- 新增页面需在 `App.tsx` 和 `useAppStore.ts` 的 `PageName` 类型中同步注册
- 样式使用 Tailwind CSS 工具类，避免内联 style（动画参数除外）

### 8.2 新增功能流程

1. 更新本 spec 文档中对应功能状态
2. 如为核心需求，先基于 spec 执行 plan，再开发
3. 数据结构变更需同步更新 `types.ts` 和 `db.ts`（含 IndexedDB 版本升级）
4. AI API 新增接口在 `ai.ts` 中添加，遵循现有错误处理模式（区分 401/429）

### 8.3 题库更新流程

```bash
# 1. 修改原始题目文本文件
# 2. 重新解析生成 JSON
node parse_questions.mjs
# 3. 验证格式正确后提交
npm run build
```

### 8.4 IndexedDB Schema 升级

如需新增字段或表，修改 `db.ts` 中的版本号和 `upgrade()` 回调：

```ts
db = await openDB<IELTSSchema>('ielts-speaking', 2, { // 版本号 +1
  upgrade(database, oldVersion) {
    if (oldVersion < 2) {
      // 执行迁移
    }
  },
});
```

---

## 9. 关键文件索引

| 文件 | 职责 |
|------|------|
| `app/src/types.ts` | 所有核心类型定义 |
| `app/src/stores/useAppStore.ts` | 全局状态（导航、设置、每日索引） |
| `app/src/services/db.ts` | IndexedDB 增删改查封装 |
| `app/src/services/ai.ts` | Mimo 评分 / 对话 / 关键词提示 |
| `app/src/services/stt.ts` | Mimo 录音后音频转写 |
| `app/src/services/tts.ts` | Mimo TTS 音频合成与播放 |
| `app/src/services/speechStats.ts` | 语速 / 停顿 / 填充词统计分析 |
| `app/src/hooks/useRecorder.ts` | 录音 Hook（MediaRecorder） |
| `app/src/hooks/useSTT.ts` | STT 状态管理 Hook |
| `app/src/hooks/useTTSStatus.ts` | Mimo TTS 状态订阅 Hook |
| `app/src/components/AIRequestStatus.tsx` | Mimo 请求状态提示组件 |
| `app/src/components/ui.tsx` | 统一页面骨架、按钮、筛选器、题目卡、指标卡等 UI 基础组件 |
| `app/src/components/RecorderPanel.tsx` | 录音状态中心（集成录音 + STT + 统计） |
| `app/src/components/AIFeedbackPanel.tsx` | AI 评分报告卡 |
| `app/src/components/Timer.tsx` | 倒计时 / 正计时组件 |
| `app/src/data/questions.json` | 题库数据 |
| `nginx.conf.example` | 生产 nginx 代理配置示例 |
