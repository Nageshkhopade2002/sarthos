import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import express from 'express'
import type { AddressInfo } from 'node:net'
import { createAuth, dateKeyInTimeZone, readAuthConfig, type AuthConfig } from './auth.js'

const config: AuthConfig = {
  username: 'sarthos-owner',
  password: 'test-pass-8',
  sessionSecret: 'test-session-secret-that-is-at-least-32-bytes',
  allowedOrigins: ['http://localhost:5173'],
  secureCookie: false,
  timeZone: 'Asia/Kolkata'
}
const auth = createAuth(config)
const app = express()
app.use(express.json())
app.post('/api/auth/login', auth.requireOrigin, (req, res) => {
  const body = req.body as { username?: unknown; password?: unknown }
  if (!auth.verifyCredentials(body.username, body.password)) {
    res.status(401).json({ error: 'Invalid username or password.' })
    return
  }
  const session = auth.createSession(config.username)
  auth.setSessionCookie(res, session.token)
  res.json({ csrfToken: session.csrfToken })
})
app.get('/api/logs', auth.requirePrivateApi, (req, res) => {
  res.json({ owner: req.authenticatedUser!.username })
})
app.put('/api/logs/:date', auth.requirePrivateApi, auth.requireToday, (req, res) => {
  res.json({ owner: req.authenticatedUser!.username, date: req.params.date })
})

let server: ReturnType<typeof app.listen>
let baseUrl: string
let cookie: string
let csrfToken: string

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ username: config.username, password: config.password })
  })
  assert.equal(response.status, 200)
  cookie = response.headers.getSetCookie()[0].split(';', 1)[0]
  csrfToken = ((await response.json()) as { csrfToken: string }).csrfToken
})

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
})

test('rejects unauthenticated access to private records', async () => {
  const response = await fetch(`${baseUrl}/api/logs`)
  assert.equal(response.status, 401)
})

test('allows the authenticated owner to read records', async () => {
  const response = await fetch(`${baseUrl}/api/logs`, { headers: { cookie } })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { owner: config.username })
})

test('does not accept a client-supplied owner as identity', async () => {
  const response = await fetch(`${baseUrl}/api/logs?ownerId=another-user`, { headers: { cookie } })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { owner: config.username })
})

test('rejects a session for a different user', async () => {
  const otherUserAuth = createAuth(config)
  const otherSession = otherUserAuth.createSession('another-user')
  const response = await fetch(`${baseUrl}/api/logs`, {
    headers: { cookie: `sarthos_session=${otherSession.token}` }
  })
  assert.equal(response.status, 401)
})

test('rejects historical updates and requires CSRF protection for today', async () => {
  const headers = {
    cookie,
    origin: 'http://localhost:5173',
    'x-csrf-token': csrfToken
  }
  const historical = await fetch(`${baseUrl}/api/logs/2020-01-01`, { method: 'PUT', headers })
  assert.equal(historical.status, 403)

  const today = dateKeyInTimeZone(config.timeZone)
  const missingCsrf = await fetch(`${baseUrl}/api/logs/${today}`, {
    method: 'PUT',
    headers: { cookie, origin: 'http://localhost:5173' }
  })
  assert.equal(missingCsrf.status, 403)

  const allowed = await fetch(`${baseUrl}/api/logs/${today}`, { method: 'PUT', headers })
  assert.equal(allowed.status, 200)
  assert.deepEqual(await allowed.json(), { owner: config.username, date: today })
})

test('enforces today using the configured time zone', () => {
  assert.equal(dateKeyInTimeZone('Asia/Kolkata', new Date('2026-10-12T18:30:00.000Z')), '2026-10-13')
})

test('rejects placeholder credentials and insecure production cookie configuration', () => {
  assert.throws(() => readAuthConfig({
    AUTH_USERNAME: 'owner',
    AUTH_PASSWORD: 'replace_with_a_unique_password_at_least_8_chars',
    SESSION_SECRET: 'replace_with_a_random_secret_at_least_32_bytes'
  }))
  assert.throws(() => readAuthConfig({
    AUTH_USERNAME: 'owner',
    AUTH_PASSWORD: 'valid-pass-8',
    SESSION_SECRET: 'valid-session-secret-at-least-thirty-two-bytes',
    NODE_ENV: 'production',
    FRONTEND_ORIGIN: 'https://sarthos.example'
  }))
})
