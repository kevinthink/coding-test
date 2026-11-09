import { clearSessionCookie, getSession, revokeSessions } from "@/lib/auth";

/** POST /api/admin/logout：作廢 token 並清除登入 cookie */
export async function POST() {
  try {
    const session = await getSession();
    if (session) await revokeSessions(session.adminId);
  } catch (err) {
    // 就算資料庫暫時連不上，也要把 cookie 清掉
    console.error("[admin/logout] revoke failed", err);
  }
  await clearSessionCookie();
  return Response.json({ status: "success" });
}
