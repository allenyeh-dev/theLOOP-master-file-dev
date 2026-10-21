// One-off: copy sop_images bytes from D1 into R2. Usage: node scripts/migrate-sop-images-to-r2.mjs --local|--remote
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const target = process.argv[2]
if (!['--local', '--remote'].includes(target)) throw new Error('Pass --local or --remote')
const BUCKET = 'theloop-master-file'
const wrangler = (args) => execFileSync('npx', ['wrangler', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })

const out = wrangler(['d1', 'execute', 'master-file-dev-db', target, '--json', '--command', 'SELECT id, mime, hex(data) AS h FROM sop_images'])
const rows = JSON.parse(out.slice(out.indexOf('[')))[0].results
const dir = mkdtempSync(join(tmpdir(), 'sop-img-'))
for (const r of rows) {
  const file = join(dir, String(r.id))
  writeFileSync(file, Buffer.from(r.h, 'hex'))
  wrangler(['r2', 'object', 'put', `${BUCKET}/sop-images/${r.id}`, '--file', file, '--content-type', r.mime, target])
  console.log(`copied image ${r.id} (${r.mime})`)
}
console.log(`${rows.length} image(s) copied to ${BUCKET}`)
