/**
 * 測驗資料（唯一來源）
 * 換測驗主題時只要改這個檔案：quizInfo、styles、questions 三個區塊。
 */

// ---------- 測驗資訊 ----------
export const quizInfo = {
  title: "你是哪一種 Coding 風格的人？",
  description: "8 個情境題，看看你寫程式時最像哪一派。",
};

// ---------- 風格（結果類型） ----------
// key 就是風格代號，會存進 Lead.resultType
export const styles = {
  planner: {
    name: "規劃派",
    description: "動手前先想清楚架構與步驟，喜歡一切在掌握之中。",
  },
  intuitive: {
    name: "直覺派",
    description: "先寫再說，邊做邊調整，靠手感與速度把東西做出來。",
  },
  perfectionist: {
    name: "細節派",
    description: "重視測試、命名與可讀性，交出去的程式碼要乾淨可靠。",
  },
  explorer: {
    name: "探索派",
    description: "對新技術充滿好奇，喜歡研究原理、嘗試更好的做法。",
  },
} as const;

export type StyleCode = keyof typeof styles;

// ---------- 題目 ----------
export type Option = {
  id: string; // 選項代號，會存進 Lead.answer
  text: string;
  /** 風格權重；沒寫到的風格視為 0 分 */
  weights: Partial<Record<StyleCode, number>>;
};

export type Question = {
  id: string;
  text: string;
  options: Option[];
};

export const questions: Question[] = [
  {
    id: "q1",
    text: "接到一個新需求，你的第一步是？",
    options: [
      { id: "a", text: "先畫流程圖、把任務拆成小步驟", weights: { planner: 2, perfectionist: 1 } },
      { id: "b", text: "直接打開編輯器，邊寫邊想", weights: { intuitive: 2 } },
      { id: "c", text: "先想清楚邊界情況和測試要怎麼寫", weights: { perfectionist: 2, planner: 1 } },
      { id: "d", text: "先查查有沒有新工具或套件能更快解決", weights: { explorer: 2, intuitive: 1 } },
    ],
  },
  {
    id: "q2",
    text: "程式出現一個奇怪的 bug，你會？",
    options: [
      { id: "a", text: "到處加 console.log，快速試出問題", weights: { intuitive: 2 } },
      { id: "b", text: "先寫一個能重現 bug 的測試", weights: { perfectionist: 2 } },
      { id: "c", text: "回頭檢查是不是設計一開始就有問題", weights: { planner: 2, perfectionist: 1 } },
      { id: "d", text: "深入讀原始碼和文件，搞懂底層怎麼運作", weights: { explorer: 2 } },
    ],
  },
  {
    id: "q3",
    text: "你的 commit 習慣比較像？",
    options: [
      { id: "a", text: "小步提交，訊息格式統一又清楚", weights: { perfectionist: 2, planner: 1 } },
      { id: "b", text: "做完一大段再一次 commit", weights: { intuitive: 2 } },
      { id: "c", text: "照事先拆好的任務，一項一個 commit", weights: { planner: 2 } },
      { id: "d", text: "常開實驗分支，玩完再決定要不要留", weights: { explorer: 2, intuitive: 1 } },
    ],
  },
  {
    id: "q4",
    text: "一個熱門的新框架剛發布，你會？",
    options: [
      { id: "a", text: "當天就裝起來玩玩看", weights: { explorer: 2, intuitive: 1 } },
      { id: "b", text: "評估它適不適合目前的專案和團隊", weights: { planner: 2 } },
      { id: "c", text: "等它穩定、文件齊全再說", weights: { perfectionist: 2, planner: 1 } },
      { id: "d", text: "真的用到再學，邊做邊學最快", weights: { intuitive: 2 } },
    ],
  },
  {
    id: "q5",
    text: "明天就要交，功能還沒做完，你會？",
    options: [
      { id: "a", text: "照優先順序砍掉次要功能", weights: { planner: 2 } },
      { id: "b", text: "熬夜衝刺，先讓它能動", weights: { intuitive: 2 } },
      { id: "c", text: "寧可延期，也不交半成品", weights: { perfectionist: 2 } },
      { id: "d", text: "找找有沒有現成工具或捷徑可以加速", weights: { explorer: 2, intuitive: 1 } },
    ],
  },
  {
    id: "q6",
    text: "Code review 時你最在意什麼？",
    options: [
      { id: "a", text: "架構和模組切分合不合理", weights: { planner: 2 } },
      { id: "b", text: "能跑、有解決問題就好", weights: { intuitive: 2 } },
      { id: "c", text: "命名、測試、可讀性", weights: { perfectionist: 2 } },
      { id: "d", text: "有沒有更好或更新的寫法", weights: { explorer: 2 } },
    ],
  },
  {
    id: "q7",
    text: "你寫程式時的工作環境通常是？",
    options: [
      { id: "a", text: "待辦清單、看板排得整整齊齊", weights: { planner: 2 } },
      { id: "b", text: "開一堆分頁，想到什麼做什麼", weights: { intuitive: 2, explorer: 1 } },
      { id: "c", text: "linter、formatter 規則全開", weights: { perfectionist: 2 } },
      { id: "d", text: "旁邊總有幾個 side project 在實驗", weights: { explorer: 2 } },
    ],
  },
  {
    id: "q8",
    text: "完成一個專案，最讓你有成就感的是？",
    options: [
      { id: "a", text: "一切照計畫、準時完成", weights: { planner: 2 } },
      { id: "b", text: "從零到能動的速度超快", weights: { intuitive: 2 } },
      { id: "c", text: "上線零 bug，程式碼乾乾淨淨", weights: { perfectionist: 2 } },
      { id: "d", text: "過程中學到了新東西", weights: { explorer: 2 } },
    ],
  },
];
