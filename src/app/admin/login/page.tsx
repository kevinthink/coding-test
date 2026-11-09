"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = { name: "checking" } | { name: "form"; error?: string } | { name: "submitting" };

export default function AdminLoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ name: "checking" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 已經登入就直接進後台
  useEffect(() => {
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => {
        if (r.ok) router.replace("/admin");
        else setStatus({ name: "form" });
      })
      .catch(() => setStatus({ name: "form" }));
  }, [router]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      return setStatus({ name: "form", error: "請輸入 email 和密碼" });
    }
    setStatus({ name: "submitting" });
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || j?.status !== "success") {
        throw new Error(j?.error?.message ?? `登入失敗（HTTP ${res.status}）`);
      }
      router.replace("/admin");
    } catch (err) {
      setStatus({
        name: "form",
        error: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "網路連線失敗，請再試一次",
      });
    }
  }

  const input =
    "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-slate-900">
          <span className="text-brand-600">●</span> 管理後台
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">管理員登入</h1>

        {status.name === "checking" ? (
          <p className="mt-6 text-sm text-slate-500">確認登入狀態中…</p>
        ) : (
          <form onSubmit={login} noValidate className="mt-6 space-y-3">
            <div>
              <label htmlFor="admin-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                className={input}
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                密碼
              </label>
              <input
                id="admin-password"
                type="password"
                className={input}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {status.name === "form" && status.error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {status.error}
              </p>
            )}
            <button
              type="submit"
              className="h-11 w-full rounded-lg bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              disabled={status.name === "submitting"}
            >
              {status.name === "submitting" ? "登入中…" : "登入"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
