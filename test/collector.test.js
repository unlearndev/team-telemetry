import { describe, it, expect } from 'vitest'
import { metricRecords, eventRecords } from '../src/otlp.js'
import { summarise } from '../src/summary.js'

const now = Date.UTC(2026, 9, 31, 12)
const nanos = (ms) => String(ms * 1e6)
const attr = (key, stringValue) => ({ key, value: { stringValue } })

const metrics = {
  resourceMetrics: [
    {
      resource: { attributes: [attr('service.name', 'claude-code')] },
      scopeMetrics: [
        {
          metrics: [
            {
              name: 'claude_code.cost.usage',
              sum: {
                aggregationTemporality: 1,
                dataPoints: [
                  { asDouble: 0.5, timeUnixNano: nanos(now), attributes: [attr('user.email', 'sam@x')] },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
}

const decision = (source, full_command) => ({
  resourceLogs: [
    {
      resource: { attributes: [] },
      scopeLogs: [
        {
          logRecords: [
            {
              timeUnixNano: nanos(now),
              attributes: [
                attr('event.name', 'tool_decision'),
                attr('user.email', 'sam@x'),
                attr('decision', 'accept'),
                attr('source', source),
                attr('tool_name', 'Bash'),
                attr('tool_parameters', JSON.stringify({ full_command })),
              ],
            },
          ],
        },
      ],
    },
  ],
})

describe('collector', () => {
  it('reads OTLP JSON metrics into records', () => {
    expect(metricRecords(metrics)).toEqual([
      {
        t: now,
        kind: 'metric',
        name: 'claude_code.cost.usage',
        value: 0.5,
        attrs: { 'service.name': 'claude-code', 'user.email': 'sam@x' },
      },
    ])
  })

  it('adds up cost per person', () => {
    const summary = summarise(metricRecords(metrics), { now })
    expect(summary.people).toMatchObject([{ name: 'sam@x', costUsd: 0.5 }])
  })

  it('counts commands approved at a prompt, not ones settings allowed', () => {
    const records = [
      ...eventRecords(decision('user_temporary', 'git diff')),
      ...eventRecords(decision('user_temporary', 'git diff')),
      ...eventRecords(decision('config', 'npm test')),
    ]
    const summary = summarise(records, { now })
    expect(summary.approvedByHand).toEqual([{ command: 'git diff', times: 2, people: ['sam@x'] }])
  })

  it('leaves out anything older than the window', () => {
    const old = metricRecords(metrics).map((r) => ({ ...r, t: now - 30 * 86400000 }))
    expect(summarise(old, { now }).people).toEqual([])
  })
})

describe('roster', () => {
  it('names people from the roster, lists everyone on it, and only counts outsiders', () => {
    const records = [
      { t: now, kind: 'metric', name: 'claude_code.session.count', value: 1, attrs: { 'user.email': 'sam@x' } },
      { t: now, kind: 'metric', name: 'claude_code.session.count', value: 1, attrs: { 'user.email': 'stranger@y' } },
      { t: now, kind: 'metric', name: 'claude_code.session.count', value: 1, attrs: { developer: 'jo@x' } },
    ]
    const summary = summarise(records, { now, roster: { 'sam@x': 'Sam', 'jo@x': 'Jo', 'kim@x': 'Kim' } })
    expect(summary.people.map((p) => [p.name, p.sessions])).toEqual([
      ['Jo', 1],
      ['Kim', 0],
      ['Sam', 1],
    ])
    expect(summary.outsideTheTeam).toBe(1)
  })
})
