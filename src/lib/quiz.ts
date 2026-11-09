import { questions, styles, type StyleCode } from "@/data/question";

const styleCodes = Object.keys(styles) as StyleCode[];

/**
 * 驗證使用者答案。
 * 格式：選項代號陣列，順序對應題目順序，例如 ["a","c","b","d","a","b","c","d"]
 * 有問題回傳可讀的錯誤訊息，沒問題回傳 null。
 */
export function validateAnswers(answers: unknown): string | null {
  if (!Array.isArray(answers)) {
    return "answers 必須是陣列，例如 [\"a\",\"b\",...]";
  }
  if (answers.length !== questions.length) {
    return `需要 ${questions.length} 題的答案，但收到 ${answers.length} 題`;
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const a = answers[i];
    if (typeof a !== "string" || !q.options.some((o) => o.id === a)) {
      const valid = q.options.map((o) => o.id).join("、");
      return `第 ${i + 1} 題的答案「${String(a)}」無效，可選：${valid}`;
    }
  }
  return null;
}

/** 依權重加總各風格分數，取最高分為結果；同分時取 styles 中排在前面的 */
export function scoreAnswers(answers: string[]) {
  const scores = Object.fromEntries(styleCodes.map((c) => [c, 0])) as Record<
    StyleCode,
    number
  >;

  questions.forEach((q, i) => {
    const option = q.options.find((o) => o.id === answers[i]);
    if (!option) return;
    for (const [code, w] of Object.entries(option.weights)) {
      scores[code as StyleCode] += w ?? 0;
    }
  });

  const resultType = styleCodes.reduce((best, c) =>
    scores[c] > scores[best] ? c : best
  );

  return { scores, resultType };
}

/** 把答案轉成「題目 → 所選選項」的文字，給 AI 參考 */
export function describeAnswers(answers: string[]): string {
  return questions
    .map((q, i) => {
      const option = q.options.find((o) => o.id === answers[i]);
      return `${i + 1}. ${q.text}\n   → ${option?.text ?? "（未作答）"}`;
    })
    .join("\n");
}
