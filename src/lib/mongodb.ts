import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// 存在 globalThis 上，開發模式熱重載（HMR）時模組會重新執行，但 global 不會被清掉，
// 因此可以沿用同一條連線，不會每次呼叫或每次重載都重連。
const globalForMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cached: MongooseCache =
  globalForMongoose.mongooseCache ??
  (globalForMongoose.mongooseCache = { conn: null, promise: null });

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("請在 .env.local 設定 MONGODB_URI");
    }

    // 同時有多個請求進來時，共用同一個連線中的 promise，避免重複建立連線
    cached.promise = mongoose.connect(uri, { bufferCommands: false });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // 連線失敗時清掉 promise，下次呼叫才能重試
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
