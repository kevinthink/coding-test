import bcrypt from "bcryptjs";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { normalizeEmail } from "@/lib/email";
import { connectDB } from "@/lib/mongodb";
import Admin from "@/models/Admin";

// 帳號不存在時也做一次比對，讓回應時間一致，避免被用來探測哪些 email 是管理員
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

function fail(httpStatus: number, code: string, message: string) {
  return Response.json({ status: "error", error: { code, message } }, { status: httpStatus });
}

/**
 * POST /api/admin/login
 * Body: { email, password }
 * 成功：200 並寫入 httpOnly cookie
 */
export async function POST(request: Request) {
  let email: unknown, password: unknown;
  try {
    ({ email, password } = await request.json());
  } catch {
    return fail(400, "INVALID_JSON", "請求內容不是有效的 JSON 格式");
  }

  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return fail(400, "MISSING_FIELDS", "請輸入 email 和密碼");
  }

  try {
    await connectDB();
    const admin = await Admin.findOne({ email: normalizeEmail(email) });
    const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);

    if (!admin || !ok) {
      // 不透露是帳號還是密碼錯
      return fail(401, "INVALID_CREDENTIALS", "email 或密碼錯誤");
    }

    const token = await createSessionToken({
      adminId: admin.id,
      email: admin.email,
      sessionVersion: admin.sessionVersion ?? 0,
    });
    await setSessionCookie(token);

    return Response.json({ status: "success", data: { email: admin.email } });
  } catch (err) {
    console.error("[admin/login] error", err);
    if (err instanceof Error && err.message.includes("JWT_SECRET")) {
      return fail(500, "SERVER_MISCONFIGURED", "伺服器尚未設定 JWT_SECRET");
    }
    return fail(500, "UNKNOWN_ERROR", "登入時發生錯誤，請稍後再試一次");
  }
}
