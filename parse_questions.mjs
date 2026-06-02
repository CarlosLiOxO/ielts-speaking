/**
 * 雅思口语题库 PDF 解析脚本
 * 将 questions_raw.txt 解析为结构化 JSON
 */
import fs from 'fs';

const raw = fs.readFileSync('./questions_raw.txt', 'utf-8');
const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

// ===== 工具函数 =====
/** 清理 OCR 文本中的常见乱码 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/l\s+(?=live|like|love|look|learn|leave|let|lie|list|long|lost)/g, 'I ')
    .trim();
}

/** 判断是否为 Part 1 问题行（以数字+点开头，包含问号或句号） */
function isPart1Question(line) {
  return /^\d+\.\s*.{10,}\?/.test(line) || /^\d+\.\s*[A-Z]/.test(line);
}

/** 判断是否为段落标题行（话题名称） */
function isTopicHeader(line) {
  return /^\d+\.\s*[A-Z][a-z]/.test(line) && line.length < 80 && !line.includes('?');
}

// ===== 解析状态机 =====
const result = {
  part1: {
    必考题: [],
    保留题: [],
    旧题: []
  },
  part23: {
    保留题: [],
    旧题: []
  }
};

let currentSection = null; // 'p1_必考题' | 'p1_保留题' | 'p1_旧题' | 'p23_保留题' | 'p23_旧题'
let currentTopic = null;
let currentQuestions = [];
let currentAnswer = [];
let inPart2 = false;
let inPart3 = false;
let currentPart23 = null; // { titleZh, part2: {prompt, cueCard, sampleAnswer}, part3Questions }
let currentP3Questions = [];
let currentP3Answer = [];
let currentP3Question = null;

/** 保存当前 Part 1 题目 */
function savePart1Question() {
  if (currentQuestions.length > 0 && currentTopic) {
    const sectionKey = currentSection === 'p1_必考题' ? '必考题' :
                       currentSection === 'p1_保留题' ? '保留题' : '旧题';
    let topic = result.part1[sectionKey].find(t => t.topic === currentTopic);
    if (!topic) {
      topic = { topic: currentTopic, questions: [] };
      result.part1[sectionKey].push(topic);
    }
    for (const q of currentQuestions) {
      if (q.question.length > 5) {
        topic.questions.push({
          question: cleanText(q.question),
          answer: cleanText(q.answer)
        });
      }
    }
  }
  currentQuestions = [];
  currentAnswer = [];
}

/** 保存当前 Part 2&3 */
function savePart23() {
  if (currentPart23 && currentPart23.part2 && currentPart23.titleZh) {
    // 保存最后一个 Part 3 问题
    if (currentP3Question) {
      currentP3Questions.push({
        question: cleanText(currentP3Question),
        answer: cleanText(currentP3Answer.join(' '))
      });
      currentP3Question = null;
      currentP3Answer = [];
    }
    currentPart23.part3Questions = currentP3Questions;
    const sectionKey = currentSection === 'p23_保留题' ? '保留题' : '旧题';
    result.part23[sectionKey].push(currentPart23);
  }
  currentPart23 = null;
  currentP3Questions = [];
  currentP3Question = null;
  currentP3Answer = [];
  inPart2 = false;
  inPart3 = false;
}

// ===== 主循环 =====
let i = 0;
// 跳过目录（前100行）
while (i < lines.length && i < 120) {
  const line = lines[i];
  if (line.includes('Part 1 必 考题') || line === 'Part 1 必考题') { currentSection = 'p1_必考题'; break; }
  i++;
}

for (; i < lines.length; i++) {
  const line = lines[i];

  // ===== 检测章节切换 =====
  if (/^Part\s*1\s*(必\s*考题|必考题)/.test(line)) {
    savePart1Question();
    savePart23();
    currentSection = 'p1_必考题';
    currentTopic = null;
    continue;
  }
  if (/^Part\s*1\s*(保\s*留\s*题|保留题)/.test(line)) {
    savePart1Question();
    savePart23();
    currentSection = 'p1_保留题';
    currentTopic = null;
    continue;
  }
  if (/^P\s*ar\s*t\s*1\s*(旧\s*题|旧题)/.test(line) || /^Part\s*1\s*(旧\s*题|旧题)/.test(line)) {
    savePart1Question();
    savePart23();
    currentSection = 'p1_旧题';
    currentTopic = null;
    continue;
  }
  if (/^Part\s*2\s*&\s*3\s*(保\s*留\s*题|保留题)/.test(line)) {
    savePart1Question();
    savePart23();
    currentSection = 'p23_保留题';
    currentTopic = null;
    continue;
  }
  if (/^Part\s*2\s*&\s*3\s*(旧\s*题|旧题)/.test(line)) {
    savePart1Question();
    savePart23();
    currentSection = 'p23_旧题';
    currentTopic = null;
    continue;
  }

  if (!currentSection) continue;

  // ===== Part 1 解析 =====
  if (currentSection.startsWith('p1_')) {
    // 检测话题标题（带中文的行，没有问号）
    const topicMatch = line.match(/^\d+\.\s*(.+?)\s+([\u4e00-\u9fff].*)$/);
    if (topicMatch && !line.includes('?') && line.length < 100) {
      savePart1Question();
      // 取英文部分作为 topic
      const enPart = topicMatch[1].replace(/[^\x20-\x7E]/g, '').trim();
      const zhPart = topicMatch[2].trim();
      currentTopic = `${enPart} ${zhPart}`.trim();
      continue;
    }

    // 纯中文话题行（没有英文）
    const zhTopicMatch = line.match(/^\d+\.\s*([\u4e00-\u9fff].+)$/);
    if (zhTopicMatch && !line.includes('?') && line.length < 60) {
      savePart1Question();
      currentTopic = zhTopicMatch[1];
      continue;
    }

    // 检测问题行
    if (/^\d+\.[A-Z\s]/.test(line) && line.includes('?')) {
      // 保存上一个问题的答案
      if (currentQuestions.length > 0) {
        currentQuestions[currentQuestions.length - 1].answer = currentAnswer.join(' ');
        currentAnswer = [];
      }
      currentQuestions.push({ question: line.replace(/^\d+\./, '').trim(), answer: '' });
      continue;
    }

    // 答案行
    if (currentQuestions.length > 0 && line.length > 10 && !/^\d+\./.test(line)) {
      currentAnswer.push(line);
      currentQuestions[currentQuestions.length - 1].answer = currentAnswer.join(' ');
    }
  }

  // ===== Part 2&3 解析 =====
  if (currentSection.startsWith('p23_')) {
    // 检测中文标题（序号+中文）
    const zhTitleMatch = line.match(/^\d+\.\s*([\u4e00-\u9fff].+)$/);
    if (zhTitleMatch && !line.includes('?') && line.length < 80) {
      savePart23();
      currentPart23 = { titleZh: zhTitleMatch[1], part2: null, part3Questions: [] };
      inPart2 = false;
      inPart3 = false;
      continue;
    }

    if (!currentPart23) continue;

    // 检测 Part 2 开始
    if (/^P\s*a\s*r\s*t\s*2/.test(line) || line === 'Part 2') {
      inPart2 = true;
      inPart3 = false;
      currentPart23.part2 = { prompt: '', cueCard: [], sampleAnswer: '' };
      continue;
    }

    // 检测 Part 3 开始
    if (/^P\s*a\s*r\s*t\s*3/.test(line) || line === 'Part 3') {
      inPart2 = false;
      inPart3 = true;
      continue;
    }

    if (inPart2 && currentPart23.part2) {
      const p2 = currentPart23.part2;
      // 提取 Describe... 提示语
      if (/^Describe/.test(line) && !p2.prompt) {
        p2.prompt = line;
        continue;
      }
      // 提取 You should say 列表项
      if (/^W(hat|ho|hen|here|hy|hich)/.test(line) || /^[Aa]nd\s/.test(line)) {
        p2.cueCard.push(line);
        continue;
      }
      // 其余为范文
      if (p2.prompt && line.length > 20) {
        p2.sampleAnswer += (p2.sampleAnswer ? ' ' : '') + line;
      }
    }

    if (inPart3) {
      // Part 3 问题行
      if (/^\d+\.[A-Z]/.test(line) && line.includes('?')) {
        if (currentP3Question) {
          currentP3Questions.push({
            question: cleanText(currentP3Question),
            answer: cleanText(currentP3Answer.join(' '))
          });
        }
        currentP3Question = line.replace(/^\d+\./, '').trim();
        currentP3Answer = [];
        continue;
      }
      // 答案行
      if (currentP3Question && line.length > 10) {
        currentP3Answer.push(line);
      }
    }
  }
}

// 保存最后的内容
savePart1Question();
savePart23();

// ===== 输出结果 =====
const output = JSON.stringify(result, null, 2);
fs.writeFileSync('./app/src/data/questions.json', output);

// 统计
const p1Count = Object.values(result.part1).reduce((sum, arr) => sum + arr.length, 0);
const p23Count = Object.values(result.part23).reduce((sum, arr) => sum + arr.length, 0);
let totalQ = 0;
Object.values(result.part1).forEach(arr => arr.forEach(t => totalQ += t.questions.length));

console.log(`✅ 解析完成`);
console.log(`Part 1 话题数: ${p1Count}`);
console.log(`  必考题: ${result.part1.必考题.length} 个话题`);
console.log(`  保留题: ${result.part1.保留题.length} 个话题`);
console.log(`  旧题: ${result.part1.旧题.length} 个话题`);
console.log(`Part 2&3 题数: ${p23Count}`);
console.log(`  保留题: ${result.part23.保留题.length} 题`);
console.log(`  旧题: ${result.part23.旧题.length} 题`);
console.log(`Part 1 总问题数: ${totalQ}`);
