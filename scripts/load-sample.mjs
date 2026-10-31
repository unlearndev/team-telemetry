// Loads two weeks of sample pilot data: three people, generated from a fixed seed, ending today.
// It's sample data, not a recording of real sessions. Live sessions add to it.
import { appendRecords, DATA_FILE } from '../src/collector.js'
import { rmSync } from 'node:fs'

let seed = 20261031
function random() {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const between = (lo, hi) => lo + random() * (hi - lo)
const int = (lo, hi) => Math.floor(between(lo, hi + 1))

const DAY = 24 * 60 * 60 * 1000
const MODEL = 'claude-opus-5-5'

const team = [
  {
    email: 'alex@pettycash.example',
    sessionsPerDay: [3, 5],
    mode: 'auto',
    approvals: { 'git push -u origin HEAD': 3 },
  },
  {
    email: 'priya@pettycash.example',
    sessionsPerDay: [2, 5],
    mode: 'auto',
    approvals: { 'git push -u origin HEAD': 4 },
  },
  {
    // Sam works in acceptEdits mode, so Sam's asked about most commands no rule allows
    email: 'sam@pettycash.example',
    sessionsPerDay: [1, 4],
    mode: 'acceptEdits',
    approvals: {
      'npx vitest run test/api/claims.test.js': 14,
      'npx vitest run test/policy.test.js': 6,
      'npx vitest run test/money.test.js': 3,
      'git add -A && git commit -m "fix: reject claims dated in the future"': 3,
      'git add -A && git commit -m "feat: show the approver on each claim"': 3,
      'git add -A && git commit -m "test: cover the receipt rule at exactly £10"': 3,
      'git push -u origin HEAD': 5,
    },
  },
]

const records = []
const today = new Date()
today.setHours(0, 0, 0, 0)

for (const person of team) {
  const base = { 'user.email': person.email, 'organization.id': 'org-pettycash', team: 'payments' }
  const sessions = []
  for (let d = 13; d >= 0; d--) {
    const day = new Date(today.getTime() - d * DAY)
    if (day.getDay() === 0 || day.getDay() === 6) continue
    for (let s = int(...person.sessionsPerDay); s > 0; s--) {
      const t = day.getTime() + between(9, 17.5) * 60 * 60 * 1000
      if (t > Date.now()) continue
      const id = `sample-${person.email.split('@')[0]}-${records.length}`
      const attrs = { ...base, 'session.id': id }
      const metric = (name, value, extra = {}) =>
        records.push({ t, kind: 'metric', name, value, attrs: { ...attrs, ...extra } })
      metric('claude_code.session.count', 1, { start_type: 'fresh' })
      metric('claude_code.active_time.total', int(300, 2400), { type: 'cli' })
      metric('claude_code.cost.usage', Number(between(0.8, 4.5).toFixed(4)), { model: MODEL })
      metric('claude_code.token.usage', int(40000, 600000), { model: MODEL, type: 'cacheRead' })
      metric('claude_code.lines_of_code.count', int(10, 260), { type: 'added' })
      metric('claude_code.lines_of_code.count', int(2, 90), { type: 'removed' })
      metric('claude_code.code_edit_tool.decision', int(3, 14), { decision: 'accept', tool_name: 'Edit' })
      if (random() < 0.25) metric('claude_code.code_edit_tool.decision', int(1, 2), { decision: 'reject', tool_name: 'Edit' })
      if (random() < 0.4) metric('claude_code.commit.count', 1)
      if (random() < 0.12) metric('claude_code.pull_request.count', 1)
      sessions.push({ t, attrs })
    }
  }
  for (const [full_command, times] of Object.entries(person.approvals)) {
    for (let i = 0; i < times; i++) {
      const session = sessions[int(0, sessions.length - 1)]
      records.push({
        t: session.t + int(60, 1500) * 1000,
        kind: 'event',
        name: 'tool_decision',
        attrs: {
          ...session.attrs,
          'event.name': 'tool_decision',
          decision: 'accept',
          source: 'user_temporary',
          permission_mode: person.mode,
          tool_name: 'Bash',
          tool_parameters: JSON.stringify({ bash_command: full_command.split(' ')[0], full_command }),
        },
      })
    }
  }
}

rmSync(DATA_FILE, { force: true })
appendRecords(records.sort((a, b) => a.t - b.t))
console.log(`Loaded ${records.length} sample records for ${team.length} people into .data/otel.jsonl`)
