import OpenAI from "openai";
import { quizInfo, styles } from "@/data/question";
import { describeAnswers, scoreAnswers, validateAnswers } from "@/lib/quiz";
import { getOpenAI, MissingApiKeyError, OPENAI_MODEL } from "@/lib/openai";

export const maxDuration = 60;

const MAX_LENGTH = 300;

type ErrorCode =
  | "INVALID_JSON"
  | "INVALID_ANSWERS"
  | "MISSING_API_KEY"
  | "INVALID_API_KEY"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "MODEL_NOT_FOUND"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "OPENAI_UNAVAILABLE"
  | "EMPTY_RESPONSE"
  | "UNKNOWN_ERROR";

function fail(httpStatus: number, code: ErrorCode, message: string) {
  return Response.json(
    { status: "error", error: { code, message } },
    { status: httpStatus }
  );
}

/**
 * POST /api/analyze
 * Body: { "answers": ["a","c","b","d","a","b","c","d"] }
 *
 * 成功 200：{ status: "success", data: { resultType, styleName, analysis, scores } }
 * 失敗 4xx/5xx：{ status: "error", error: { code, message } }
 * 「等待中」= 請求送出到回應之前（前端顯示 loading），後端最多等 OpenAI 30 秒就會回錯誤，不會無限等待。
 */
export async function POST(request: Request) {
  // 1. 解析並驗證輸入
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "INVALID_JSON", "請求內容不是有效的 JSON 格式");
  }

  const answers = (body as { answers?: unknown } | null)?.answers;
  const invalid = validateAnswers(answers);
  if (invalid) return fail(400, "INVALID_ANSWERS", invalid);
  const validAnswers = answers as string[];

  // 2. 風格代號由權重計算，結果穩定、不依賴 AI
  const { scores, resultType } = scoreAnswers(validAnswers);
  const style = styles[resultType];

  // 3. 呼叫 OpenAI 產生個人化分析
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "你是一位親切、有洞察力的軟體工程導師。請用繁體中文、第二人稱「你」撰寫個人化分析。" +
            `全文不超過 250 字，純文字，不要使用 Markdown、標題或條列符號。`,
        },
        {
          role: "user",
          content: [
            `測驗：${quizInfo.title}`,
            `測驗結果：${style.name}（${style.description}）`,
            `各風格分數：${Object.entries(scores)
              .map(([c, s]) => `${styles[c as keyof typeof styles].name} ${s}`)
              .join("、")}`,
            "",
            "使用者的作答：",
            describeAnswers(validAnswers),
            "",
            "請根據以上作答，說明這個人的 coding 風格特質、優勢，以及一個具體可行的成長建議。",
          ].join("\n"),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return fail(502, "EMPTY_RESPONSE", "AI 沒有產生任何內容，請稍後再試一次");
    }

    return Response.json({
      status: "success",
      data: {
        resultType,
        styleName: style.name,
        analysis: limitLength(text, MAX_LENGTH),
        scores,
      },
    });
  } catch (err) {
    return handleOpenAIError(err);
  }
}

/** 超過字數時，在上限內最後一個句號處截斷，避免斷在半句 */
function limitLength(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max).join("");
  const lastStop = Math.max(...["。", "！", "？"].map((p) => cut.lastIndexOf(p)));
  return lastStop > 0 ? cut.slice(0, lastStop + 1) : cut;
}

function handleOpenAIError(err: unknown) {
  if (err instanceof MissingApiKeyError) {
    return fail(500, "MISSING_API_KEY", "伺服器尚未設定 OPENAI_API_KEY，請在 .env.local 加入後重新啟動");
  }
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return fail(504, "TIMEOUT", "AI 分析逾時（超過 30 秒），請稍後再試一次");
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return fail(503, "NETWORK_ERROR", "無法連線到 OpenAI，請檢查網路後再試一次");
  }
  if (err instanceof OpenAI.AuthenticationError) {
    return fail(500, "INVALID_API_KEY", "OpenAI 金鑰無效或已過期，請檢查 OPENAI_API_KEY");
  }
  if (err instanceof OpenAI.RateLimitError) {
    if (err.code === "insufficient_quota") {
      return fail(503, "QUOTA_EXCEEDED", "OpenAI 帳戶額度已用完，請確認帳單與用量設定");
    }
    return fail(429, "RATE_LIMITED", "目前請求太頻繁，請等幾秒後再試一次");
  }
  if (err instanceof OpenAI.NotFoundError) {
    return fail(500, "MODEL_NOT_FOUND", `找不到模型「${OPENAI_MODEL}」，請檢查 OPENAI_MODEL 設定`);
  }
  if (err instanceof OpenAI.InternalServerError) {
    return fail(502, "OPENAI_UNAVAILABLE", "OpenAI 服務暫時異常，請稍後再試一次");
  }
  if (err instanceof OpenAI.APIError) {
    console.error("[analyze] OpenAI API error", err.status, err.message);
    return fail(502, "UNKNOWN_ERROR", `AI 服務回傳錯誤（${err.status ?? "未知"}）：${err.message}`);
  }
  console.error("[analyze] unexpected error", err);
  return fail(500, "UNKNOWN_ERROR", "分析時發生未預期的錯誤，請稍後再試一次");
}
