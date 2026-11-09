/**
 * 一次性建立管理員帳號
 *
 * 用法（在專案根目錄）：npm run create-admin
 * 會互動式詢問 email 與密碼（密碼不顯示在螢幕上、不留在指令歷史）。
 * 資料庫已經有管理員時會拒絕執行，避免被重複建立或覆蓋。
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import readline from "node:readline";
import Admin from "../src/models/Admin.ts";

const MIN_PASSWORD_LENGTH = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------- 輸入工具 ----------

// 非互動模式（stdin 被導向）時，一次讀進所有行
let pipedLines: string[] | null = null;
async function readPipedLine(): Promise<string> {
  if (!pipedLines) {
    const rl = readline.createInterface({ input: process.stdin });
    pipedLines = [];
    for await (const line of rl) pipedLines.push(line);
  }
  return pipedLines.shift() ?? "";
}

async function ask(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    process.stdout.write(question + "\n");
    return readPipedLine();
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((r) => rl.question(question, r));
  rl.close();
  return answer;
}

/** 輸入密碼時不把字元印到螢幕上 */
async function askHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    process.stdout.write(question + "\n");
    return readPipedLine();
  }
  process.stdout.write(question);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise((resolve) => {
    let value = "";
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (c === "\u0003") {
          process.stdout.write("\n已取消\n");
          process.exit(1);
        }
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

// ---------- 主程式 ----------

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("找不到 MONGODB_URI，請確認 .env.local");

  await mongoose.connect(uri);

  const existing = await Admin.findOne().lean();
  if (existing) {
    throw new Error(`已經有管理員帳號（${existing.email}），此腳本只能用一次。`);
  }

  const email = (await ask("管理員 email：")).trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) throw new Error("email 格式不正確");

  const password = await askHidden(`密碼（至少 ${MIN_PASSWORD_LENGTH} 字元）：`);
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`密碼太短，至少需要 ${MIN_PASSWORD_LENGTH} 字元`);
  }
  const confirm = await askHidden("再輸入一次密碼：");
  if (password !== confirm) throw new Error("兩次輸入的密碼不一致");

  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({ email, passwordHash });

  console.log(`\n✓ 已建立管理員：${email}`);
}

main()
  .catch((err) => {
    console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
