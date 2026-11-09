// 確保這個檔案只會在後端執行；若被前端元件 import，build 會直接報錯，金鑰不會外洩
import "server-only";
import OpenAI from "openai";

let client: OpenAI | null = null;

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new MissingApiKeyError();
  }
  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30_000, // 最多等 30 秒，避免前端一直卡在等待中
    maxRetries: 1,
  });
  return client;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not set");
  }
}
