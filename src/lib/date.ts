export const isoDate = (date: Date) => {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0')
  return `${y}-${m}-${d}`
}
export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate()+days); return isoDate(d)
}
export const dayNumber = (start: string, today = isoDate(new Date())) => {
  const a = new Date(`${start}T00:00:00`).getTime(), b = new Date(`${today}T00:00:00`).getTime()
  return Math.floor((b-a)/86400000)+1
}
export const prettyDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'})