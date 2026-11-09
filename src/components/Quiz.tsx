"use client";

import { useRef, useState } from "react";
import { questions, quizInfo, styles } from "@/data/question";
import { isValidEmail } from "@/lib/email";

type Analysis = {
  resultType: string;
  styleName: string;
  analysis: string;
  scores?: Record<string, number>; // /api/analyze 原本就有回傳，這裡只拿來畫圖
};

type Step =
  | { name: "intro" }
  | { name: "question"; index: number }
  | { name: "email" }
  | { name: "loading"; message: string }
  | { name: "error"; message: string }
  | { name: "result"; data: Analysis };

/** 呼叫 API，失敗時丟出帶有可讀訊息的 Error */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("網路連線失敗，請檢查網路後再試一次");
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.status !== "success") {
    throw new Error(json?.error?.message ?? `伺服器發生錯誤（HTTP ${res.status}），請稍後再試一次`);
  }
  return json.data as T;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

// ---------- 共用樣式 ----------
const primaryBtn =
  "inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-8 text-lg font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:opacity-50 sm:w-auto";
const ghostBtn =
  "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

function Arrow({ dir = "right" }: { dir?: "left" | "right" }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-5 w-5 ${dir === "left" ? "rotate-180" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 0 1 .75-.75h10.64l-3.22-3.22a.75.75 0 1 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H3.75A.75.75 0 0 1 3 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
      <div
        className="h-full rounded-full bg-brand-600 transition-[width] duration-500 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default function Quiz() {
  const [step, setStep] = useState<Step>({ name: "intro" });
  const [answers, setAnswers] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  // AI 分析成功後先暫存，若只是存名單失敗，重試時不必再花一次 AI 費用
  const analysisCache = useRef<Analysis | null>(null);

  function start() {
    setAnswers([]);
    setEmail("");
    setEmailError("");
    analysisCache.current = null;
    setStep({ name: "question", index: 0 });
  }

  function choose(index: number, optionId: string) {
    const next = [...answers.slice(0, index), optionId];
    setAnswers(next);
    analysisCache.current = null; // 答案變了，舊的分析作廢
    setStep(index + 1 < questions.length ? { name: "question", index: index + 1 } : { name: "email" });
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();

    // 沒有有效 email 就不往下走，絕對拿不到結果
    if (!email.trim()) return setEmailError("請填寫 email");
    if (!isValidEmail(email)) return setEmailError("email 格式不正確");
    setEmailError("");

    try {
      let analysis = analysisCache.current;
      if (!analysis) {
        setStep({ name: "loading", message: "AI 分析中，請稍候（約 5～30 秒）…" });
        analysis = await postJson<Analysis>("/api/analyze", { answers });
        analysisCache.current = analysis;
      }

      setStep({ name: "loading", message: "正在儲存你的結果…" });
      await postJson("/api/leads", {
        email,
        answers,
        result: analysis.analysis,
        resultType: analysis.resultType,
      });

      setStep({ name: "result", data: analysis });
    } catch (err) {
      setStep({
        name: "error",
        message: err instanceof Error ? err.message : "發生未預期的錯誤，請稍後再試一次",
      });
    }
  }

  // ---------- 畫面 ----------

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
        <span className="text-sm font-semibold tracking-wide text-brand-600">CODING STYLE QUIZ</span>
        {step.name === "question" && (
          <span className="text-sm font-medium tabular-nums text-slate-400">
            {String(step.index + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}
          </span>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10 sm:px-8">
        {renderStep()}
      </main>
    </div>
  );

  function renderStep() {
    if (step.name === "intro") {
      return (
        <section key="intro" className="animate-enter">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
            {questions.length} 題 · 約 2 分鐘 · AI 個人化分析
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-balance sm:text-6xl">
            {quizInfo.title}
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-500 sm:text-xl">
            {quizInfo.description}
          </p>
          <div className="mt-10">
            <button className={primaryBtn} onClick={start}>
              開始測驗 <Arrow />
            </button>
          </div>
        </section>
      );
    }

    if (step.name === "question") {
      const q = questions[step.index];
      return (
        <section className="w-full">
          <ProgressBar value={(step.index / questions.length) * 100} />

          {/* key 隨題號改變，每題都會重新播放進場動畫 */}
          <div key={step.index} className="animate-enter">
            <p className="mt-8 text-sm font-semibold text-brand-600">QUESTION {step.index + 1}</p>
            <h2 className="mt-2 text-2xl font-bold leading-snug tracking-tight text-balance sm:text-4xl">
              {q.text}
            </h2>

            <ul className="mt-8 grid gap-3">
              {q.options.map((o, i) => {
                const selected = answers[step.index] === o.id;
                return (
                  <li key={o.id}>
                    <button
                      onClick={() => choose(step.index, o.id)}
                      className={`group flex w-full items-center gap-4 rounded-2xl border-2 bg-white p-4 text-left transition sm:p-5 ${
                        selected
                          ? "border-brand-600 bg-brand-50"
                          : "border-slate-200 hover:border-brand-500 hover:bg-brand-50/50"
                      } active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition ${
                          selected
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-500 group-hover:bg-brand-600 group-hover:text-white"
                        }`}
                      >
                        {LETTERS[i] ?? i + 1}
                      </span>
                      <span className="text-base font-medium leading-snug sm:text-lg">{o.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-6 h-8">
            {step.index > 0 && (
              <button className={ghostBtn} onClick={() => setStep({ name: "question", index: step.index - 1 })}>
                <Arrow dir="left" /> 上一題
              </button>
            )}
          </div>
        </section>
      );
    }

    if (step.name === "email") {
      return (
        <section className="w-full">
          <ProgressBar value={100} />
          <div className="animate-enter">
            <p className="mt-8 text-sm font-semibold text-brand-600">LAST STEP</p>
            <h2 className="mt-2 text-3xl font-bold leading-snug tracking-tight sm:text-4xl">
              留下 email，
              <br className="sm:hidden" />
              解鎖你的分析結果
            </h2>
            <p className="mt-3 text-slate-500">AI 會根據你的 {questions.length} 個選擇，寫一份專屬於你的分析。</p>

            <form onSubmit={submit} noValidate className="mt-8 space-y-4">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className={`h-14 w-full rounded-2xl border-2 bg-white px-5 text-lg outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                    emailError
                      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                      : "border-slate-200 focus:border-brand-600 focus:ring-brand-100"
                  }`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "email-error" : undefined}
                  autoFocus
                />
                {emailError && (
                  <p id="email-error" className="mt-2 text-sm font-medium text-red-600">
                    {emailError}
                  </p>
                )}
              </div>
              <button type="submit" className={primaryBtn}>
                查看我的結果 <Arrow />
              </button>
            </form>

            <div className="mt-6">
              <button className={ghostBtn} onClick={() => setStep({ name: "question", index: questions.length - 1 })}>
                <Arrow dir="left" /> 上一題
              </button>
            </div>
          </div>
        </section>
      );
    }

    if (step.name === "loading") {
      return (
        <section role="status" aria-live="polite" className="flex animate-enter flex-col items-center text-center">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-4 border-brand-100" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-brand-600" />
          </div>
          <p className="mt-8 text-xl font-semibold sm:text-2xl">{step.message}</p>
          <p className="mt-2 text-slate-500">請不要關閉這個頁面</p>
        </section>
      );
    }

    if (step.name === "error") {
      return (
        <section role="alert" className="animate-enter rounded-3xl border border-red-100 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl font-bold text-red-500">
            !
          </div>
          <h2 className="mt-5 text-2xl font-bold">哎呀，出了點問題</h2>
          <p className="mt-2 text-lg leading-relaxed text-slate-600">{step.message}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button className={primaryBtn} onClick={() => submit()}>
              重試
            </button>
            <button className={ghostBtn} onClick={() => setStep({ name: "email" })}>
              返回修改 email
            </button>
          </div>
        </section>
      );
    }

    // result
    return <ResultCard data={step.data} onRestart={start} />;
  }
}

/** 結果卡：設計成直式、一個畫面就裝得下，方便截圖分享 */
function ResultCard({ data, onRestart }: { data: Analysis; onRestart: () => void }) {
  const style = styles[data.resultType as keyof typeof styles];
  const scores = data.scores ?? {};
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const today = new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(new Date());

  return (
    <section className="w-full animate-pop">
      <article className="overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-brand-900/10 ring-1 ring-slate-100">
        {/* 主視覺 */}
        <div className="relative overflow-hidden bg-brand-600 px-6 pb-10 pt-8 text-white sm:px-10 sm:pb-12 sm:pt-10">
          <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -bottom-24 right-16 h-48 w-48 rounded-full bg-white/5" />
          <p className="relative text-sm font-medium text-brand-100">我的 Coding 風格是</p>
          <div className="relative mt-4 flex items-center gap-4 sm:gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl font-extrabold text-brand-600 shadow-lg sm:h-20 sm:w-20 sm:text-4xl">
              {data.styleName.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{data.styleName}</h2>
              <p className="mt-1 text-sm font-medium uppercase tracking-widest text-brand-200">{data.resultType}</p>
            </div>
          </div>
          {style && <p className="relative mt-6 text-lg leading-relaxed text-white/90">{style.description}</p>}
        </div>

        {/* 分數 */}
        {ranked.length > 0 && (
          <div className="border-b border-slate-100 px-6 py-6 sm:px-10">
            <ul className="space-y-3">
              {ranked.map(([code, score]) => {
                const pct = Math.round((score / total) * 100);
                const isTop = code === data.resultType;
                return (
                  <li key={code} className="flex items-center gap-3 text-sm">
                    <span className={`w-14 shrink-0 font-semibold ${isTop ? "text-brand-600" : "text-slate-500"}`}>
                      {styles[code as keyof typeof styles]?.name ?? code}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${isTop ? "bg-brand-600" : "bg-brand-200"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-slate-500">{pct}%</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* AI 分析 */}
        <div className="px-6 py-7 sm:px-10 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">AI 個人分析</p>
          <p className="mt-3 whitespace-pre-line text-base leading-8 text-slate-700 sm:text-lg sm:leading-9">
            {data.analysis}
          </p>
        </div>

        <footer className="flex items-center justify-between bg-slate-50 px-6 py-4 text-xs text-slate-400 sm:px-10">
          <span className="font-semibold text-slate-500">{quizInfo.title}</span>
          <span className="shrink-0 pl-3">{today}</span>
        </footer>
      </article>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button className={primaryBtn} onClick={onRestart}>
          重新測驗
        </button>
      </div>
      <p className="mt-4 text-center text-sm text-slate-400">截圖分享給朋友，看看他們是哪一派</p>
    </section>
  );
}
