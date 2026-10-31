import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { metricRecords, eventRecords } from './otlp.js'
import { summarise } from './summary.js'

export const DATA_FILE = join(process.cwd(), '.data', 'otel.jsonl')
const TEAM_FILE = join(process.cwd(), 'team.json')

function roster() {
  return existsSync(TEAM_FILE) ? JSON.parse(readFileSync(TEAM_FILE, 'utf8')).people : undefined
}

export function readRecords(file = DATA_FILE) {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

export function appendRecords(records, file = DATA_FILE) {
  if (!records.length) return
  mkdirSync(join(file, '..'), { recursive: true })
  appendFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n')
}

async function json(req) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw ? JSON.parse(raw) : {}
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function collector() {
  return {
    name: 'team-telemetry-collector',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url.split('?')[0]
        try {
          if (req.method === 'POST' && path === '/v1/metrics') {
            appendRecords(metricRecords(await json(req)))
            return send(res, 200, {})
          }
          if (req.method === 'POST' && path === '/v1/logs') {
            appendRecords(eventRecords(await json(req)))
            return send(res, 200, {})
          }
          if (req.method === 'POST' && path === '/v1/traces') return send(res, 200, {})
          if (req.method === 'GET' && path === '/api/summary') {
            const days = Number(new URL(req.url, 'http://x').searchParams.get('days') ?? 14)
            return send(res, 200, summarise(readRecords(), { days, roster: roster() }))
          }
        } catch (error) {
          return send(res, 400, { error: error.message })
        }
        next()
      })
    },
  }
}
