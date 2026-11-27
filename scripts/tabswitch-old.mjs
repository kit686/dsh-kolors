/**
 * Prove the harness catches the bug: run the same scenario against the previous
 * build. If this file reports the same result as the fixed build, the harness is
 * not testing anything.
 *
 * Run with: node scripts/tabswitch-old.mjs
 */
import { copyFileSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

// The client.js as of the commit before the fix.
const old = execFileSync('git', ['show', 'HEAD:client.js'], { cwd: root, encoding: 'utf8' })
const oldPath = join(here, '_build-old.js')
writeFileSync(oldPath, old)

// The harness, pointed at that file instead of the shipped one.
const harness = readFileSync(join(here, 'tabswitch.mjs'), 'utf8')
const retargeted = harness.replace(
  "readFileSync(join(here, '..', 'client.js'), 'utf8')",
  "readFileSync(join(here, '_build-old.js'), 'utf8')",
)
const harnessPath = join(here, '_tabswitch-old.mjs')
writeFileSync(harnessPath, retargeted)

let out = ''
let code = 0
try {
  out = execFileSync(process.execPath, [harnessPath], { cwd: root, encoding: 'utf8' })
} catch (error) {
  out = String(error.stdout ?? '')
  code = error.status ?? 1
}

unlinkSync(oldPath)
unlinkSync(harnessPath)

const failures = [...out.matchAll(/ {2}FAIL (.+?)(?: — (.*))?$/gm)].map((m) => m[1])
console.log(out.trimEnd())
console.log('\n=== verdict ===')
if (code === 0) {
  console.log('PROBLEM: the previous build passes too — the harness proves nothing')
  process.exitCode = 1
} else {
  console.log(`the previous build fails ${failures.length} assertion(s):`)
  for (const name of failures) console.log(`  - ${name}`)
  console.log('so the harness does distinguish the bug from the fix')
}
