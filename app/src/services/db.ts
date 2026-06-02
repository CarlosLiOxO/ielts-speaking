/**
 * IndexedDB 数据持久化服务
 * 存储练习记录、设置和历史录音
 */
import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { PracticeRecord, AppSettings } from '../types';

interface IELTSSchema extends DBSchema {
  records: {
    key: number;
    value: PracticeRecord;
    indexes: {
      'by-date': string;
      'by-part': string;
      'by-topic': string;
    };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let db: IDBPDatabase<IELTSSchema> | null = null;

/** 初始化数据库 */
async function getDB(): Promise<IDBPDatabase<IELTSSchema>> {
  if (db) return db;
  db = await openDB<IELTSSchema>('ielts-speaking', 1, {
    upgrade(database) {
      // 创建练习记录表
      const recordStore = database.createObjectStore('records', {
        keyPath: 'id',
        autoIncrement: true,
      });
      recordStore.createIndex('by-date', 'date');
      recordStore.createIndex('by-part', 'part');
      recordStore.createIndex('by-topic', 'topicOrTitle');

      // 创建设置表
      database.createObjectStore('settings', { keyPath: 'key' });
    },
  });
  return db;
}

/** 保存练习记录 */
export async function saveRecord(record: PracticeRecord): Promise<number> {
  const database = await getDB();
  // idb 已根据 schema 将返回值类型推断为 Promise<number>，无需强制转换
  return database.add('records', record);
}

/** 回写练习记录的 AI 反馈 */
export async function updateRecordFeedback(id: number, aiFeedback: string): Promise<void> {
  const database = await getDB();
  const record = await database.get('records', id);
  if (!record) return;
  record.aiFeedback = aiFeedback;
  await database.put('records', record);
}

/** 获取所有练习记录（按日期倒序） */
export async function getAllRecords(): Promise<PracticeRecord[]> {
  const database = await getDB();
  const records = await database.getAll('records');
  return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** 获取指定话题的历史记录 */
export async function getRecordsByTopic(topic: string): Promise<PracticeRecord[]> {
  const database = await getDB();
  return database.getAllFromIndex('records', 'by-topic', topic);
}

/** 获取今天的练习记录 */
export async function getTodayRecords(): Promise<PracticeRecord[]> {
  const today = new Date().toISOString().split('T')[0];
  const database = await getDB();
  // by-date 索引存储完整 ISO 字符串（如 "2026-04-15T10:30:00.000Z"），
  // 需用 IDBKeyRange 范围查询匹配当天所有时间点，不能用精确匹配
  const range = IDBKeyRange.bound(today, today + '\uffff');
  return database.getAllFromIndex('records', 'by-date', range);
}

/** 获取昨天的同一话题记录（用于对比） */
export async function getYesterdayRecord(topic: string): Promise<PracticeRecord | null> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const database = await getDB();
  const records = await database.getAllFromIndex('records', 'by-topic', topic);
  const yesterdayRecord = records.find(r => r.date.startsWith(yesterdayStr));
  return yesterdayRecord || null;
}

/** 删除练习记录 */
export async function deleteRecord(id: number): Promise<void> {
  const database = await getDB();
  await database.delete('records', id);
}

/** 标记薄弱话题 */
export async function toggleWeakRecord(id: number, isWeak: boolean): Promise<void> {
  const database = await getDB();
  const record = await database.get('records', id);
  if (record) {
    record.isWeak = isWeak;
    await database.put('records', record);
  }
}

/** 获取所有薄弱话题 */
export async function getWeakTopics(): Promise<string[]> {
  const database = await getDB();
  const records = await database.getAll('records');
  const weakTopics = new Set(
    records.filter(r => r.isWeak).map(r => r.topicOrTitle)
  );
  return Array.from(weakTopics);
}

/** 保存设置 */
export async function saveSetting(key: string, value: unknown): Promise<void> {
  const database = await getDB();
  await database.put('settings', { key, value });
}

/** 读取设置 */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const database = await getDB();
  const item = await database.get('settings', key);
  return item ? (item.value as T) : defaultValue;
}

/** 读取所有应用设置 */
export async function loadSettings(): Promise<AppSettings> {
  return {
    dashscopeApiKey: await getSetting('dashscopeApiKey', ''),
    glmApiKey: await getSetting('glmApiKey', ''),
    practiceMode: await getSetting<'normal' | 'stress' | 'warmup'>('practiceMode', 'normal'),
    enableTTS: await getSetting('enableTTS', true),
    enableSTT: await getSetting('enableSTT', true),
  };
}

/** 保存所有应用设置 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await saveSetting(key, value);
  }
}
