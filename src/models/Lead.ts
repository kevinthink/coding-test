import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const LeadSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true, // 在 MongoDB 建立唯一索引
      trim: true,
      lowercase: true, // 統一小寫，避免 A@x.com 與 a@x.com 被當成兩筆
    },
    answer: {
      type: [String],
      default: [],
    },
    result: {
      type: String, // 分析全文
      default: "",
    },
    resultType: {
      type: String, // 風格代號
      default: "",
    },
  },
  {
    // 只自動產生 createdAt，不需要 updatedAt
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// 後台名單依填答時間由新到舊排序
LeadSchema.index({ createdAt: -1 });

export type Lead = InferSchemaType<typeof LeadSchema>;

// 開發模式熱重載時 model 已註冊過，沿用既有的避免 OverwriteModelError
const LeadModel: Model<Lead> =
  (models.Lead as Model<Lead>) || model<Lead>("Lead", LeadSchema);

export default LeadModel;
