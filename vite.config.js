import { defineConfig } from 'vite'
import { collector } from './src/collector.js'

// One process: an OTLP/HTTP receiver on /v1/metrics and /v1/logs, and the dashboard on /.
// 4318 is the usual port for OTLP over HTTP, so Claude Code's endpoint is http://localhost:4318
export default defineConfig({
  plugins: [collector()],
  server: { host: '127.0.0.1', port: 4318, strictPort: true },
})
