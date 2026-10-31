const money = (usd) => `$${usd.toFixed(2)}`
const whole = (n) => Math.round(n).toLocaleString('en-GB')
const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '')

function cells(values) {
  const tr = document.createElement('tr')
  for (const value of values) {
    const td = document.createElement('td')
    td.textContent = value
    tr.append(td)
  }
  return tr
}

async function render() {
  const days = new URLSearchParams(location.search).get('days') ?? 14
  const data = await (await fetch(`/api/summary?days=${days}`)).json()
  document.querySelector('#range').textContent = `Payments team · last ${data.days} days`
  document.querySelector('#people tbody').replaceChildren(
    ...data.people.map((p) =>
      cells([
        p.name,
        whole(p.sessions),
        p.activeHours.toFixed(1),
        money(p.costUsd),
        whole(p.linesAdded),
        whole(p.commits),
        whole(p.approvedByHand),
        when(p.lastSeen),
      ]),
    ),
  )
  document
    .querySelector('#approved tbody')
    .replaceChildren(
      ...data.approvedByHand.slice(0, 10).map((r) => cells([r.command, r.times, r.people.join(', ')])),
    )
}

render()
setInterval(render, 5000)
