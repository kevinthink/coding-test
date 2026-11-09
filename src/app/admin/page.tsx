"use client";

// 注意：這個頁面本身不含任何名單資料，資料只能透過 /api/admin/leads 取得，
// 而那支 API 會在後端驗證登入。前端的轉址只是讓使用體驗順一點，不是安全機制。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LeadItem = {
  id: string;
  email: string;
  resultType: string;
  styleName: string;
  createdAt: string;
};

type LeadsData = {
  items: LeadItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type State =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "ready"; data: LeadsData };

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

async function fetchLeads(p: number): Promise<State | "unauthorized"> {
  try {
    const res = await fetch(`/api/admin/leads?page=${p}`, { cache: "no-store" });
    if (res.status === 401) return "unauthorized";
    const j = await res.json().catch(() => null);
    if (!res.ok || j?.status !== "success") {
      return { name: "error", message: j?.error?.message ?? `讀取失敗（HTTP ${res.status}）` };
    }
    return { name: "ready", data: j.data };
  } catch {
    return { name: "error", message: "網路連線失敗，請再試一次" };
  }
}

// ---------- 樣式 ----------
const btn =
  "inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-40";
const btnPrimary =
  "inline-flex h-9 items-center justify-center rounded-lg bg-brand-600 px-3 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-40";

export default function AdminLeadsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [state, setState] = useState<State>({ name: "loading" });

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false; // 快速切頁時，丟掉過期的回應
    fetchLeads(page).then((result) => {
      if (ignore) return;
      if (result === "unauthorized") router.replace("/admin/login");
      else setState(result);
    });
    return () => {
      ignore = true;
    };
  }, [page, reloadKey, router]);

  function goTo(p: number) {
    setState({ name: "loading" });
    setPage(p);
    setReloadKey((k) => k + 1);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    router.replace("/admin/login");
  }

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const hasData = state.name === "ready" && state.data.total > 0;

  // 檔案由後端產生，前端只負責把收到的檔案存下來
  async function downloadExcel() {
    setDownloading(true);
    setDownloadError("");
    try {
      const res = await fetch("/api/admin/leads/export", { cache: "no-store" });
      if (res.status === 401) return router.replace("/admin/login");
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? `下載失敗（HTTP ${res.status}）`);
      }
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ?? "leads.xlsx";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(
        err instanceof Error && err.message !== "Failed to fetch" ? err.message : "網路連線失敗，請再試一次"
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="text-sm font-semibold text-slate-900">
            <span className="text-brand-600">●</span> 管理後台
          </span>
          <button className="text-sm font-medium text-slate-500 hover:text-slate-900" onClick={logout}>
            登出
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">名單</h1>
            <p className="mt-1 text-sm text-slate-500">
              {state.name === "ready" ? `共 ${state.data.total} 筆` : " "}
            </p>
          </div>
          <button className={btnPrimary} onClick={downloadExcel} disabled={!hasData || downloading}>
            {downloading ? "產生中…" : "下載 Excel"}
          </button>
        </div>

        {downloadError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {downloadError}
          </p>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {state.name === "loading" && <p className="px-4 py-16 text-center text-sm text-slate-500">載入中…</p>}

          {state.name === "error" && (
            <div role="alert" className="space-y-3 px-4 py-16 text-center">
              <p className="text-sm text-red-600">{state.message}</p>
              <button className={btn} onClick={() => goTo(page)}>
                重試
              </button>
            </div>
          )}

          {state.name === "ready" &&
            (state.data.items.length === 0 ? (
              <p className="px-4 py-16 text-center text-sm text-slate-500">目前還沒有任何名單。</p>
            ) : (
              <>
              {/* 手機：一筆一張卡 */}
              <ul className="divide-y divide-slate-100 sm:hidden">
                {state.data.items.map((l) => (
                  <li key={l.id} className="space-y-1.5 px-4 py-3">
                    <p className="break-all text-sm font-medium text-slate-900">{l.email}</p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                        {l.styleName}
                        <span className="font-mono text-brand-500">{l.resultType}</span>
                      </span>
                      <span className="text-xs tabular-nums text-slate-500">{formatTime(l.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* 平板以上：表格 */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">風格</th>
                      <th className="px-4 py-3">填答時間</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {state.data.items.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{l.email}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                            {l.styleName}
                            <span className="font-mono text-brand-500">{l.resultType}</span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500">
                          {formatTime(l.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            ))}
        </div>

        {state.name === "ready" && state.data.totalPages > 0 && (
          <div className="flex items-center justify-between">
            <button
              className={btn}
              disabled={state.data.page <= 1}
              onClick={() => goTo(state.data.page - 1)}
            >
              上一頁
            </button>
            <span className="text-sm tabular-nums text-slate-500">
              第 {state.data.page} / {state.data.totalPages} 頁
            </span>
            <button
              className={btn}
              disabled={state.data.page >= state.data.totalPages}
              onClick={() => goTo(state.data.page + 1)}
            >
              下一頁
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
