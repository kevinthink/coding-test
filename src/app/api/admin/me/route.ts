import { requireAdmin } from "@/lib/auth";

/** GET /api/admin/me：回傳目前登入的管理員；未登入回 401 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  return Response.json({ status: "success", data: { email: auth.session.email } });
}
