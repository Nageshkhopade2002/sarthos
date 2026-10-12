import {
  createHmac,
  randomBytes,
  timingSafeEqual
} from 'node:crypto'
import type { NextFunction, Request, RequestHandler, Response } from 'express'

const cookieName = 'sarthos_session'
const sessionLifetimeSeconds = 60 * 60 * 24 * 7
const localDevelopmentOrigins = 'http://localhost:5173,http://127.0.0.1:5173'

export type AuthConfig = {
  username: string
  password: string
  sessionSecret: string
  allowedOrigins: string[]
  secureCookie: boolean
  timeZone: string
}

export type AuthenticatedUser = {
  username: string
  csrfToken: string
}

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: AuthenticatedUser
    }
  }
}

export function readAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const username = env.AUTH_USERNAME?.trim()
  const password = env.AUTH_PASSWORD
  const sessionSecret = env.SESSION_SECRET
  const secureCookieSetting = env.COOKIE_SECURE || 'false'
  const secureCookie = secureCookieSetting === 'true'
  const timeZone = env.APP_TIME_ZONE?.trim() || 'Asia/Kolkata'

  if (!username || username.length > 100) throw new Error('AUTH_USERNAME is required and must be at most 100 characters.')
  if (!password || password.startsWith('replace_') || password.length < 8 || password.length > 200) {
    throw new Error('AUTH_PASSWORD must contain between 8 and 200 characters.')
  }
  if (!sessionSecret || sessionSecret.startsWith('replace_') || Buffer.byteLength(sessionSecret) < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 bytes.')
  }
  if (sessionSecret === password) throw new Error('SESSION_SECRET and AUTH_PASSWORD must be different.')
  if (secureCookieSetting !== 'true' && secureCookieSetting !== 'false') {
    throw new Error('COOKIE_SECURE must be either true or false.')
  }
  if (env.NODE_ENV === 'production' && !secureCookie) {
    throw new Error('COOKIE_SECURE=true is required in production.')
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format()
  } catch {
    throw new Error('APP_TIME_ZONE must be a valid IANA time zone.')
  }

  const allowedOrigins = (env.FRONTEND_ORIGIN || localDevelopmentOrigins)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
  if (!allowedOrigins.length || allowedOrigins.some(origin => {
    try {
      const parsed = new URL(origin)
      return !['http:', 'https:'].includes(parsed.protocol)
        || parsed.origin !== origin
        || (secureCookie && parsed.protocol !== 'https:')
    } catch {
      return true
    }
  })) {
    throw new Error('FRONTEND_ORIGIN must contain exact http(s) origins, using HTTPS when secure cookies are enabled.')
  }

  return {
    username,
    password,
    sessionSecret,
    allowedOrigins,
    secureCookie,
    timeZone
  }
}

export function createAuth(config: AuthConfig) {
  const secureCookie = config.secureCookie
  const cookieOptions = [
    'Path=/api',
    'HttpOnly',
    `SameSite=${secureCookie ? 'None' : 'Lax'}`,
    `Max-Age=${sessionLifetimeSeconds}`,
    ...(secureCookie ? ['Secure'] : [])
  ].join('; ')

  const clearCookieOptions = [
    'Path=/api',
    'HttpOnly',
    `SameSite=${secureCookie ? 'None' : 'Lax'}`,
    'Max-Age=0',
    ...(secureCookie ? ['Secure'] : [])
  ].join('; ')

  function sign(payload: string): string {
    return createHmac('sha256', config.sessionSecret).update(payload).digest('base64url')
  }

  function createSession(username: string): { token: string; csrfToken: string } {
    const csrfToken = randomBytes(32).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      username,
      csrfToken,
      expiresAt: Math.floor(Date.now() / 1000) + sessionLifetimeSeconds
    })).toString('base64url')
    return { token: `${payload}.${sign(payload)}`, csrfToken }
  }

  function getSession(req: Request): AuthenticatedUser | null {
    const cookieHeader = req.headers.cookie
    if (!cookieHeader) return null
    const token = cookieHeader.split(';').map(part => part.trim())
      .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
    if (!token) return null
    const [payload, signature, ...extra] = token.split('.')
    if (!payload || !signature || extra.length) return null

    const expected = Buffer.from(sign(payload))
    const actual = Buffer.from(signature)
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null

    try {
      const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
        username?: unknown
        csrfToken?: unknown
        expiresAt?: unknown
      }
      if (session.username !== config.username
        || typeof session.csrfToken !== 'string'
        || typeof session.expiresAt !== 'number'
        || session.expiresAt <= Math.floor(Date.now() / 1000)) return null
      return { username: session.username, csrfToken: session.csrfToken }
    } catch {
      return null
    }
  }

  const requireOrigin: RequestHandler = (req, res, next) => {
    const origin = req.get('origin')
    if (!origin || !config.allowedOrigins.includes(origin)) {
      res.status(403).json({ error: 'Request origin is not allowed.' })
      return
    }
    next()
  }

  const requireAuthentication: RequestHandler = (req, res, next) => {
    const session = getSession(req)
    if (!session) {
      res.status(401).json({ error: 'Authentication required.' })
      return
    }
    req.authenticatedUser = session
    next()
  }

  const requireCsrf: RequestHandler = (req, res, next) => {
    const session = req.authenticatedUser
    const token = req.get('x-csrf-token')
    if (!session || !token) {
      res.status(403).json({ error: 'A valid CSRF token is required.' })
      return
    }
    const expected = Buffer.from(session.csrfToken)
    const actual = Buffer.from(token)
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      res.status(403).json({ error: 'A valid CSRF token is required.' })
      return
    }
    next()
  }

  const requirePrivateApi: RequestHandler = (req, res, next) => {
    requireAuthentication(req, res, () => {
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        next()
        return
      }
      requireOrigin(req, res, () => requireCsrf(req, res, next))
    })
  }

  const requireToday: RequestHandler = (req, res, next) => {
    const date = req.params.date
    const today = dateKeyInTimeZone(config.timeZone)
    if (date !== today) {
      res.status(403).json({ error: 'Only today’s daily record can be created or edited.' })
      return
    }
    next()
  }

  function setSessionCookie(res: Response, token: string): void {
    res.append('Set-Cookie', `${cookieName}=${token}; ${cookieOptions}`)
  }

  function removeSessionCookie(res: Response): void {
    res.append('Set-Cookie', `${cookieName}=; ${clearCookieOptions}`)
  }

  function verifyCredentials(username: unknown, password: unknown): boolean {
    if (typeof username !== 'string' || typeof password !== 'string') return false
    const usernameMatches = timingSafeEqual(
      Buffer.from(createHmac('sha256', config.sessionSecret).update(username).digest()),
      Buffer.from(createHmac('sha256', config.sessionSecret).update(config.username).digest())
    )
    const passwordMatches = timingSafeEqual(
      Buffer.from(createHmac('sha256', config.sessionSecret).update(password).digest()),
      Buffer.from(createHmac('sha256', config.sessionSecret).update(config.password).digest())
    )
    return usernameMatches && passwordMatches
  }

  return {
    createSession,
    getSession,
    requireOrigin,
    requireAuthentication,
    requireCsrf,
    requirePrivateApi,
    requireToday,
    setSessionCookie,
    removeSessionCookie,
    verifyCredentials,
    sessionLifetimeSeconds
  }
}

export function dateKeyInTimeZone(timeZone: string, instant = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(instant)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}
