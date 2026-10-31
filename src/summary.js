// Adds up the records per person, and lists the commands people approved at a permission prompt.

const DAY = 24 * 60 * 60 * 1000

// Who a record belongs to: the person's login email on a Team or Enterprise plan,
// or a `developer` resource attribute where a team sets one itself.
export function identity(attrs) {
  return attrs.developer ?? attrs['user.email'] ?? attrs['user.account_uuid'] ?? 'unknown'
}

function blank(name) {
  return {
    name,
    sessions: 0,
    activeHours: 0,
    costUsd: 0,
    tokens: 0,
    linesAdded: 0,
    linesRemoved: 0,
    commits: 0,
    pullRequests: 0,
    editsAccepted: 0,
    editsRejected: 0,
    approvedByHand: 0,
    lastSeen: 0,
  }
}

// Bash commands only arrive when OTEL_LOG_TOOL_DETAILS=1. Without it, we only know the tool.
// Anything in quotes, like a commit message, is hidden, so the same command groups together.
export function command(attrs) {
  if (attrs.tool_name !== 'Bash') return attrs.tool_name
  try {
    const full = JSON.parse(attrs.tool_parameters).full_command ?? 'Bash'
    return full.replace(/"[^"]*"/g, '"…"').replace(/'[^']*'/g, "'…'")
  } catch {
    return 'Bash'
  }
}

function tally(map, key, who) {
  const row = map.get(key) ?? { command: key, times: 0, people: new Set() }
  row.times += 1
  row.people.add(who)
  map.set(key, row)
}

// `roster` maps identities to names ({ "sam@pettycash.example": "Sam" }). Everyone on it gets a row,
// even with no sessions, and anything from outside it is only counted.
export function summarise(records, { days = 14, now = Date.now(), roster } = {}) {
  const since = now - days * DAY
  const people = new Map()
  const approved = new Map()
  let outsideTheTeam = 0
  for (const name of Object.values(roster ?? {})) people.set(name, blank(name))

  for (const r of records) {
    if (r.t < since) continue
    const id = identity(r.attrs)
    const who = roster ? roster[id] : id
    if (!who) {
      if (r.name === 'claude_code.session.count') outsideTheTeam += r.value
      continue
    }
    const p = people.get(who) ?? blank(who)
    people.set(who, p)
    p.lastSeen = Math.max(p.lastSeen, r.t)

    if (r.kind === 'metric') {
      const type = r.attrs.type
      switch (r.name) {
        case 'claude_code.session.count': p.sessions += r.value; break
        case 'claude_code.active_time.total': p.activeHours += r.value / 3600; break
        case 'claude_code.cost.usage': p.costUsd += r.value; break
        case 'claude_code.token.usage': p.tokens += r.value; break
        case 'claude_code.commit.count': p.commits += r.value; break
        case 'claude_code.pull_request.count': p.pullRequests += r.value; break
        case 'claude_code.lines_of_code.count':
          if (type === 'added') p.linesAdded += r.value
          if (type === 'removed') p.linesRemoved += r.value
          break
        case 'claude_code.code_edit_tool.decision':
          if (r.attrs.decision === 'accept') p.editsAccepted += r.value
          if (r.attrs.decision === 'reject') p.editsRejected += r.value
          break
      }
    } else if (r.name === 'tool_decision') {
      // user_temporary is "yes, once"; user_permanent is "yes, don't ask again" (and its later uses)
      const { decision, source } = r.attrs
      if (decision === 'accept' && String(source).startsWith('user_')) {
        p.approvedByHand += 1
        tally(approved, command(r.attrs), who)
      }
    }
  }

  const rows = (map) =>
    [...map.values()]
      .map((row) => ({ ...row, people: [...row.people].sort() }))
      .sort((a, b) => b.times - a.times)

  return {
    days,
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)),
    approvedByHand: rows(approved),
    outsideTheTeam,
  }
}
