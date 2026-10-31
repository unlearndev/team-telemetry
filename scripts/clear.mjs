import { rmSync } from 'node:fs'
import { DATA_FILE } from '../src/collector.js'

rmSync(DATA_FILE, { force: true })
console.log('Cleared .data/otel.jsonl')
