// Turns OTLP/HTTP JSON (what Claude Code sends with OTEL_EXPORTER_OTLP_PROTOCOL=http/json)
// into flat records: { t, kind: 'metric' | 'event', name, value?, attrs }.

function value(v) {
  if (!v) return undefined
  if ('stringValue' in v) return v.stringValue
  if ('intValue' in v) return Number(v.intValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('boolValue' in v) return v.boolValue
  return JSON.stringify(v)
}

function attributes(list = []) {
  return Object.fromEntries(list.map((a) => [a.key, value(a.value)]))
}

const ms = (nanos) => Math.round(Number(nanos) / 1e6)

export function metricRecords(body) {
  const records = []
  for (const rm of body.resourceMetrics ?? []) {
    const resource = attributes(rm.resource?.attributes)
    for (const sm of rm.scopeMetrics ?? []) {
      for (const metric of sm.metrics ?? []) {
        const points = (metric.sum ?? metric.gauge)?.dataPoints ?? []
        for (const point of points) {
          records.push({
            t: ms(point.timeUnixNano),
            kind: 'metric',
            name: metric.name,
            value: point.asDouble ?? Number(point.asInt ?? 0),
            attrs: { ...resource, ...attributes(point.attributes) },
          })
        }
      }
    }
  }
  return records
}

export function eventRecords(body) {
  const records = []
  for (const rl of body.resourceLogs ?? []) {
    const resource = attributes(rl.resource?.attributes)
    for (const sl of rl.scopeLogs ?? []) {
      for (const log of sl.logRecords ?? []) {
        const attrs = { ...resource, ...attributes(log.attributes) }
        records.push({ t: ms(log.timeUnixNano), kind: 'event', name: attrs['event.name'], attrs })
      }
    }
  }
  return records
}
