import * as XLSX from "xlsx";
import { styles, type StyleCode } from "@/data/question";
import { requireAdmin } from "@/lib/auth";
import Lead from "@/models/Lead";

const TIME_ZONE = "Asia/Taipei";

/** 2026-08-03（台灣時間），用於檔名 */
function dateForFilename(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);
}

/** 2026/08/03 14:05:09（台灣時間），用於表格內容 */
function formatTime(d: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * GET /api/admin/leads/export
 * 需要管理員登入，否則回 401。
 * 回傳 leads-YYYY-MM-DD.xlsx，欄位：Email、風格、填答時間
 */
export async function GET() {
  // 先驗證身分，沒過就不碰資料
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const docs = await Lead.find()
      .sort({ createdAt: -1, _id: -1 })
      .select("email resultType createdAt")
      .lean();

    if (docs.length === 0) {
      return Response.json(
        { status: "error", error: { code: "NO_DATA", message: "目前沒有任何名單可以匯出" } },
        { status: 404 }
      );
    }

    const rows = docs.map((d) => ({
      Email: d.email,
      風格: styles[d.resultType as StyleCode]?.name ?? d.resultType,
      填答時間: d.createdAt ? formatTime(new Date(d.createdAt)) : "",
    }));

    // 所有值都以「文字」寫入，不會被 Excel 當成公式執行
    const sheet = XLSX.utils.json_to_sheet(rows, { header: ["Email", "風格", "填答時間"] });
    sheet["!cols"] = [{ wch: 36 }, { wch: 12 }, { wch: 22 }];

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "名單");
    const buffer: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });

    const filename = `leads-${dateForFilename(new Date())}.xlsx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store", // 名單是個資，不要被快取
      },
    });
  } catch (err) {
    console.error("[admin/leads/export] error", err);
    return Response.json(
      { status: "error", error: { code: "EXPORT_FAILED", message: "產生 Excel 時發生錯誤，請稍後再試" } },
      { status: 500 }
    );
  }
}
