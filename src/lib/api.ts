export type ActivityEntry = { yes: boolean | null; amount?: string; reason?: string }
export type Meal = { eaten: boolean | null; food: string; reason?: string; nutritionEstimate?: string }
export type DailyLog = {
  date: string
  wakeTime: string
  bedTime: string
  activities: Record<string, ActivityEntry>
  meals: Record<string, Meal>
  notes: string
}
export type AnalysisKind = 'daily' | 'weekly' | '30day' | '80day'
export type Report = { date: string; kind: AnalysisKind; report: string; cached?: boolean }

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
let csrfToken: string | null = null

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    const method = init?.method?.toUpperCase() || 'GET'
    const headers = new Headers(init?.headers)
    headers.set('Content-Type', 'application/json')
    if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      headers.set('X-CSRF-Token', csrfToken)
    }
    response = await fetch(`${apiBase}/api${path}`, {
      ...init,
      credentials: 'include',
      headers
    })
  } catch {
    throw new Error('Cannot reach the backend. Start the server and check its MongoDB connection.')
  }
  const result = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new ApiError(result.error || `Backend request failed (${response.status}).`, response.status)
  return result
}

export type AuthSession = { authenticated: boolean; csrfToken?: string }

export async function getAuthSession(): Promise<AuthSession> {
  const session = await request<AuthSession>('/auth/session')
  csrfToken = session.authenticated ? session.csrfToken || null : null
  return session
}

export async function login(username: string, password: string): Promise<void> {
  const session = await request<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })
  csrfToken = session.csrfToken || null
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' })
  csrfToken = null
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

export async function getDailyLogs(): Promise<DailyLog[]> {
  const result = await request<{ logs: DailyLog[] }>('/logs')
  return result.logs
}

export async function getDailyLog(date: string): Promise<DailyLog> {
  const result = await request<{ log: DailyLog }>(`/logs/${encodeURIComponent(date)}`)
  return result.log
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

export async function saveDailyLog(log: DailyLog): Promise<DailyLog> {
  const result = await request<{ log: DailyLog }>(`/logs/${encodeURIComponent(log.date)}`, {
    method: 'PUT',
    body: JSON.stringify(log)
  })
  return result.log
}

export async function getReports(date: string): Promise<Report[]> {
  const result = await request<{ reports: Report[] }>(`/reports?date=${encodeURIComponent(date)}`)
  return result.reports
}

export async function getSavedReport(date: string, kind: AnalysisKind): Promise<Report | null> {
  const result = await request<{ reports: Report[] }>(`/reports?date=${encodeURIComponent(date)}&kind=${kind}`)
  return result.reports[0] || null
}

export async function requestAnalysis(date: string, kind: AnalysisKind): Promise<Report> {
  return request<Report>('/analysis', { method: 'POST', body: JSON.stringify({ date, kind }) })
}

export async function getStoredNutritionEstimate(food: string): Promise<string> {
  const result = await request<{ estimate: string }>('/meals/nutrition', {
    method: 'POST',
    body: JSON.stringify({ food })
  })
  return result.estimate
}
