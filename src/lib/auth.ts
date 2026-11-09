// 只能在後端使用：JWT_SECRET 絕不能進到前端
import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { connectDB } from "@/lib/mongodb";
import Admin from "@/models/Admin";

export const SESSION_COOKIE = "admin_session";
const SESSION_DAYS = 7;

export type AdminSession = { adminId: string; email: string; sessionVersion: number };

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET 未設定或太短（至少 32 字元），請檢查 .env.local");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: AdminSession): Promise<string> {
  return new SignJWT({ email: session.email, sv: session.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.adminId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

/** 只驗證 token 本身（簽章、過期）；無效回傳 null */
async function verifySessionToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.sv !== "number") {
      return null;
    }
    return { adminId: payload.sub, email: payload.email, sessionVersion: payload.sv };
  } catch {
    return null;
  }
}

/** 寫入登入 cookie（只能在 Route Handler 或 Server Action 中呼叫） */
export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // 前端 JS 讀不到，防止 XSS 偷 token
    secure: process.env.NODE_ENV === "production", // 正式環境只走 HTTPS
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * 取得目前登入的管理員（完整驗證）：
 * 1. cookie 裡有 token  2. 簽章正確且未過期
 * 3. 資料庫裡仍有這個管理員  4. token 版本與資料庫一致（沒被登出作廢）
 * 任何一項不符都回傳 null。
 */
export async function getSession(): Promise<AdminSession | null> {
  return sessionFromToken(await readSessionCookie());
}

async function readSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

async function sessionFromToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  await connectDB();
  const admin = await Admin.findById(session.adminId).select("sessionVersion").lean();
  if (!admin || (admin.sessionVersion ?? 0) !== session.sessionVersion) return null;

  return session;
}

/** 登出：作廢這個管理員所有已簽發的 token */
export async function revokeSessions(adminId: string) {
  await connectDB();
  await Admin.updateOne({ _id: adminId }, { $inc: { sessionVersion: 1 } });
}

/** 給 API 用：未登入時直接回傳 401 Response */
export async function requireAdmin(): Promise<
  { ok: true; session: AdminSession } | { ok: false; response: Response }
> {
  // 讀 cookie 放在 try 外面：build 時 Next.js 靠 cookies() 丟出的訊號判斷這支 API 是動態的，不能攔截
  const token = await readSessionCookie();
  let session: AdminSession | null;
  try {
    session = await sessionFromToken(token);
  } catch (err) {
    // 無法確認身分時一律拒絕，不放行
    console.error("[auth] session check failed", err);
    return {
      ok: false,
      response: Response.json(
        { status: "error", error: { code: "AUTH_UNAVAILABLE", message: "暫時無法驗證登入狀態，請稍後再試" } },
        { status: 503 }
      ),
    };
  }
  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { status: "error", error: { code: "UNAUTHORIZED", message: "尚未登入或登入已過期" } },
        { status: 401 }
      ),
    };
  }
  return { ok: true, session };
}
