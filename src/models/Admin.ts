// 注意：這個檔案也會被 scripts/create-admin.ts 直接用 Node 執行，
// 所以只能 import 套件或相對路徑，不要用 "@/..." 別名。
import mongoose, { type InferSchemaType, type Model } from "mongoose";

// mongoose 是 CommonJS 套件，Node 直接執行時不支援具名 import，改從預設匯出取出
const { Schema, model, models } = mongoose;

const AdminSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    // 只存 bcrypt 雜湊，絕不存明碼
    passwordHash: {
      type: String,
      required: true,
    },
    // 每次登出 +1；JWT 內記錄簽發時的版本，版本不符就視為失效
    // → 登出後，就算有人留著舊 token 也無法再使用
    sessionVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export type Admin = InferSchemaType<typeof AdminSchema>;

const AdminModel: Model<Admin> =
  (models.Admin as Model<Admin>) || model<Admin>("Admin", AdminSchema);

export default AdminModel;
