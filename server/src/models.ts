import mongoose from 'mongoose'

const dailyLogSchema = new mongoose.Schema({
  ownerId: { type: String, required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  wakeTime: { type: String, required: true, maxlength: 10 },
  bedTime: { type: String, required: true, maxlength: 10 },
  activities: { type: mongoose.Schema.Types.Mixed, required: true },
  meals: { type: mongoose.Schema.Types.Mixed, required: true },
  notes: { type: String, required: true, maxlength: 3000 }
}, { timestamps: true, strict: true })
dailyLogSchema.index({ ownerId: 1, date: 1 }, { unique: true })

const reportSchema = new mongoose.Schema({
  ownerId: { type: String, required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  kind: { type: String, enum: ['daily', 'weekly', '30day', '80day'], required: true },
  sourceHash: { type: String, required: true },
  report: { type: String, required: true, maxlength: 10000 }
}, { timestamps: true, strict: true })
reportSchema.index({ ownerId: 1, date: 1, kind: 1 }, { unique: true })
reportSchema.index({ ownerId: 1, date: -1 })

export type DailyLogRecord = {
  ownerId: string
  date: string
  wakeTime: string
  bedTime: string
  activities: Record<string, unknown>
  meals: Record<string, unknown>
  notes: string
  createdAt?: Date
  updatedAt?: Date
  _id?: mongoose.Types.ObjectId
  __v?: number
}
export type ReportRecord = {
  ownerId: string
  date: string
  kind: 'daily' | 'weekly' | '30day' | '80day'
  sourceHash: string
  report: string
  createdAt?: Date
  updatedAt?: Date
  _id?: mongoose.Types.ObjectId
  __v?: number
}

export const DailyLogModel: mongoose.Model<DailyLogRecord> = mongoose.models.DailyLog as mongoose.Model<DailyLogRecord>
  || mongoose.model<DailyLogRecord>('DailyLog', dailyLogSchema)
export const ReportModel: mongoose.Model<ReportRecord> = mongoose.models.AiReport as mongoose.Model<ReportRecord>
  || mongoose.model<ReportRecord>('AiReport', reportSchema)
