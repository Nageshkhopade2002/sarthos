import type { AppData, DayLog } from '../types'

const DB_NAME = 'self-upgrade-db'
const STORE = 'app'
const KEY = 'main'
const LOCAL_KEY = 'self-upgrade-v1'

const initial: AppData = {
  profile: { name: 'My Self Upgrade', startDate: '2026-10-11', height: 170 },
  logs: {}
}

export async function loadData(): Promise<AppData> {
  try {
    if (!('indexedDB' in window)) return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null') || initial
    const db = await openDb()
    const result = await new Promise<AppData | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return result || initial
  } catch {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null') || initial } catch { return initial }
  }
}
export async function saveData(data: AppData): Promise<void> {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  if (!('indexedDB' in window)) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(data, KEY)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
export function emptyLog(date: string): DayLog {
  return { date, completed: [], minutes: {}, notes: '', waterLitres: 0, runningKm: 0, runningMinutes: 0, meals: '' }
}
export function downloadJson(data: AppData) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = 'self-upgrade-backup.json'; a.click()
  URL.revokeObjectURL(url)
}
export function downloadCsv(data: AppData) {
  const rows = [['date','completedCount','weightKg','waistCm','runningKm','runningMinutes','waterLitres','notes']]
  Object.values(data.logs).sort((a,b)=>a.date.localeCompare(b.date)).forEach(l => rows.push([
    l.date, String(l.completed.length), String(l.weight ?? ''), String(l.waist ?? ''),
    String(    l.runningKm ?? ''), String(l.runningMinutes ?? ''), String(l.waterLitres ?? ''), l.notes.replace(/"/g,'""')
  ]))
  const csv = rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a'); a.href=url; a.download='self-upgrade-progress.csv'; a.click(); URL.revokeObjectURL(url)
}