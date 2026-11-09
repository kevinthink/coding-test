import { styles, type StyleCode } from "@/data/question";
import { requireAdmin } from "@/lib/auth";
import Lead from "@/models/Lead";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function toPositiveInt(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * GET /api/admin/leads?page=1&limit=20
 * 需要管理員登入（後端驗證 cookie 中的 JWT），否則回 401。
 * 回傳：{ status: "success", data: { items, page, limit, total, totalPages } }
 */
export async function GET(request: Request) {
  // 第一件事就是驗證身分，沒過就不碰資料
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = Math.min(toPositiveInt(url.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
  const requestedPage = toPositiveInt(url.searchParams.get("page"), 1);

  try {
    // requireAdmin 已經建立資料庫連線
    const total = await Lead.countDocuments();
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, totalPages);

    const docs = await Lead.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("email resultType createdAt")
      .lean();

    const items = docs.map((d) => ({
      id: String(d._id),
      email: d.email,
      resultType: d.resultType,
      styleName: styles[d.resultType as StyleCode]?.name ?? d.resultType,
      createdAt: d.createdAt,
    }));

    return Response.json({
      status: "success",
      data: { items, page, limit, total, totalPages },
    });
  } catch (err) {
    console.error("[admin/leads] error", err);
    return Response.json(
      { status: "error", error: { code: "DB_ERROR", message: "讀取名單時發生錯誤，請稍後再試" } },
      { status: 500 }
    );
  }
}
