import mongoose from "mongoose";
import { styles } from "@/data/question";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { connectDB } from "@/lib/mongodb";
import { scoreAnswers, validateAnswers } from "@/lib/quiz";
import Lead from "@/models/Lead";

// 公開 API：填測驗的人不需要登入

const MAX_RESULT_LENGTH = 2000;

type ErrorCode =
  | "INVALID_JSON"
  | "INVALID_EMAIL"
  | "INVALID_ANSWERS"
  | "INVALID_RESULT"
  | "INVALID_RESULT_TYPE"
  | "VALIDATION_ERROR"
  | "DB_UNAVAILABLE"
  | "UNKNOWN_ERROR";

function fail(httpStatus: number, code: ErrorCode, message: string) {
  return Response.json(
    { status: "error", error: { code, message } },
    { status: httpStatus }
  );
}

/**
 * POST /api/leads
 * Body: { email, answers: ["a",...8 題], result: "分析全文", resultType: "planner" }
 *
 * 成功：201 新增 / 200 更新 → { status: "success", data: { email, action: "created" | "updated" } }
 * 失敗：4xx/5xx → { status: "error", error: { code, message } }
 */
export async function POST(request: Request) {
  // 1. 解析輸入
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error();
    }
    body = parsed;
  } catch {
    return fail(400, "INVALID_JSON", "請求內容不是有效的 JSON 物件");
  }

  const { email, answers, result, resultType } = body;

  // 2. 驗證 email
  if (typeof email !== "string" || !email.trim()) {
    return fail(400, "INVALID_EMAIL", "請填寫 email");
  }
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(email)) {
    return fail(400, "INVALID_EMAIL", `「${email.trim()}」不是有效的 email 格式`);
  }

  // 3. 驗證答案
  const invalidAnswers = validateAnswers(answers);
  if (invalidAnswers) return fail(400, "INVALID_ANSWERS", invalidAnswers);
  const validAnswers = answers as string[];

  // 4. 驗證分析結果
  if (typeof result !== "string" || !result.trim()) {
    return fail(400, "INVALID_RESULT", "缺少分析內容（result）");
  }
  if ([...result].length > MAX_RESULT_LENGTH) {
    return fail(400, "INVALID_RESULT", `分析內容過長，最多 ${MAX_RESULT_LENGTH} 字`);
  }

  // 5. 驗證風格代號：必須存在，且要跟答案算出來的結果一致，避免存進對不上的資料
  if (typeof resultType !== "string" || !(resultType in styles)) {
    const valid = Object.keys(styles).join("、");
    return fail(400, "INVALID_RESULT_TYPE", `風格代號「${String(resultType)}」無效，可用：${valid}`);
  }
  const expected = scoreAnswers(validAnswers).resultType;
  if (resultType !== expected) {
    return fail(
      400,
      "INVALID_RESULT_TYPE",
      `風格代號「${resultType}」與答案不符，依答案應為「${expected}」`
    );
  }

  // 6. 寫入資料庫：同一個 email 就更新，沒有就新增
  try {
    await connectDB();
    const res = await upsertLead(normalizedEmail, {
      answer: validAnswers,
      result: result.trim(),
      resultType,
    });

    const created = res.upsertedCount > 0;
    return Response.json(
      {
        status: "success",
        data: { email: normalizedEmail, action: created ? "created" : "updated" },
      },
      { status: created ? 201 : 200 }
    );
  } catch (err) {
    return handleDbError(err);
  }
}

type LeadFields = { answer: string[]; result: string; resultType: string };

async function upsertLead(email: string, fields: LeadFields) {
  const run = () =>
    Lead.updateOne(
      { email },
      { $set: fields }, // createdAt 只在第一次新增時寫入（Mongoose timestamps 自動處理）
      { upsert: true, runValidators: true }
    );

  try {
    return await run();
  } catch (err) {
    // 同一個 email 幾乎同時送出兩次時，兩邊都可能嘗試新增而撞到唯一索引；
    // 這時資料已經存在，再跑一次就會變成更新
    if (isDuplicateKeyError(err)) return await run();
    throw err;
  }
}

function isDuplicateKeyError(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

function handleDbError(err: unknown) {
  if (err instanceof Error && err.message.includes("MONGODB_URI")) {
    return fail(500, "DB_UNAVAILABLE", "伺服器尚未設定 MONGODB_URI，請在 .env.local 加入後重新啟動");
  }
  if (
    err instanceof mongoose.Error.MongooseServerSelectionError ||
    (err instanceof Error && /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timed out/i.test(err.message))
  ) {
    console.error("[leads] db connection error", err);
    return fail(503, "DB_UNAVAILABLE", "暫時無法連線到資料庫，請稍後再試一次");
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return fail(400, "VALIDATION_ERROR", `資料格式不正確：${err.message}`);
  }
  console.error("[leads] unexpected error", err);
  return fail(500, "UNKNOWN_ERROR", "儲存資料時發生未預期的錯誤，請稍後再試一次");
}
