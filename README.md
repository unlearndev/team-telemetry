# Team telemetry

A tiny OpenTelemetry collector and dashboard for one team's Claude Code usage. It's for the course demo: your company will usually send the same data to a collector it already runs (Grafana, Datadog, Honeycomb and so on).

```bash
npm install
npm run dev      # collector and dashboard on http://localhost:4318
npm run sample   # load two weeks of sample pilot data (replaces what's there)
npm run clear    # delete everything collected
npm test
```

Claude Code sends to it with these settings (OTLP over HTTP, as JSON):

```bash
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

`team.json` lists who's on the team. Sessions from anyone else are only counted.
