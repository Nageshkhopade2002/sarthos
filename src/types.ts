export type Habit = { id: string; title: string; category: string; targetMinutes?: number }
export type DayLog = {
  date: string
  completed: string[]
  minutes: Record<string, number>
  notes: string
  weight?: number
  height?: number
  waist?: number
  runningKm?: number
  runningMinutes?: number
  waterLitres?: number
  meals?: string
  mood?: number
  photoDataUrl?: string
}
export type Profile = { name: string; startDate: string; height?: number; startWeight?: number; goalWeight?: number }
export type AppData = { profile: Profile; logs: Record<string, DayLog> }