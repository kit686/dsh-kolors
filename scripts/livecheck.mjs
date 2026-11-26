/**
 * Live end-to-end check against the running Harness: drives the same HTTP
 * routes the panel calls, with no network generation (the picture is a fixture
 * PNG written into the preview folder the plugin owns).
 *
 * Every fixture it creates is removed before it exits, so the user's real saves
 * and trash are untouched.
 *
 * Run with: node scripts/livecheck.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const origin = process.env.KOLORS_ORIGIN ?? 'http://127.0.0.1:4969'
const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const frameRoot = join(home, 'kolors-frames')

let pass = 0
let fail = 0
const check = (label, ok, detail) => {
  if (ok) { pass += 1; console.log(`  ok  ${label}`) }
  else { fail += 1; console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`) }
}

const created = { previews: [], savedIds: [], trashIds: [] }

async function call(method, path, body) {
  const response = await fetch(`${origin}/kolors${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  let parsed
  try { parsed = await response.json() } catch { parsed = undefined }
  return { status: response.status, body: parsed, headers: response.headers }
}

let table = null
function crc32(buffer) {
  if (table === null) {
    table = new Int32Array(256)
    for (let n = 0; n < 256; n += 1) {
      let c = n
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let crc = -1
  for (const byte of buffer) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return crc ^ -1
}

/** A 64x64 solid PNG, so the routes can be exercised without the network. */
function png() {
  const width = 64
  const height = 64
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1)
    for (let x = 0; x < width; x += 1) {
      const at = row + 1 + x * 3
      raw[at] = 20 + x
      raw[at + 1] = 90
      raw[at + 2] = 140
    }
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([length, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const state = await call('GET', '/state')
check('the panel route answers', state.status === 200, state.status)
check('the model is locked to Kolors', state.body.model === 'Kwai-Kolors/Kolors', state.body.model)
check('the state reports the trash directory', String(state.body.trashDir).includes('dsh-kolors-trash'), state.body.trashDir)
check('the state reports the history windows', (state.body.limits?.windows ?? []).join() === '1,3,7,30,0')
check('the state publishes a boot id', typeof state.body.boot === 'string' && state.body.boot !== '', state.body.boot)
check('the state advertises no preview folder', state.body.cacheDir === undefined, state.body.cacheDir)

// ---- a frame that must survive a tab switch: written the way generate() does.
const frame = join(frameRoot, `live-${Date.now()}.png`)
mkdirSync(frameRoot, { recursive: true })
writeFileSync(frame, png())
created.previews.push(frame)
check('a frame fixture is on disk', existsSync(frame))

// ---- save it
const saved = await call('POST', '/save', {
  file: frame, prompt: 'livecheck 雨夜街角', negative: '模糊', size: '1024x1024',
  steps: 26, guidance: 8.5, seed: 12345, at: Date.now(), keyLabel: 'livecheck',
})
check('save answers 200', saved.status === 200, JSON.stringify(saved.body))
created.savedIds.push(saved.body.saved.id)
check('the saved copy exists', existsSync(saved.body.saved.path))
check('the saved copy sits outside the trash', !saved.body.saved.path.includes('dsh-kolors-trash'))
check('saving consumed the pending frame', !existsSync(frame))

// The stage keeps showing the filed picture; leaving the page must not blank it.
const afterSave = await call('GET', '/state')
check('the filed picture stays on the stage', afterSave.body.preview?.filed === true, JSON.stringify(afterSave.body.preview))
check('the stage points at the saved copy', afterSave.body.preview?.file === saved.body.saved.path, afterSave.body.preview?.file)

const streamed = await fetch(`${origin}${saved.body.saved.src}`)
const bytes = new Uint8Array(await streamed.arrayBuffer())
check('the saved picture streams back', streamed.ok && streamed.headers.get('content-type') === 'image/png', streamed.status)
check('the streamed bytes are a PNG', bytes[0] === 0x89 && bytes[1] === 0x50, `${bytes[0]},${bytes[1]}`)

// ---- the routes must not serve each other's files
const crossFrame = await fetch(`${origin}/kolors/frame?p=${encodeURIComponent(saved.body.saved.path)}`)
check('the saved file is not served by the frame route', crossFrame.status === 403, crossFrame.status)
const crossSaved = await fetch(`${origin}/kolors/saved?p=${encodeURIComponent(saved.body.saved.path)}`)
check('a saved file streams from the saved route', crossSaved.ok, crossSaved.status)
const crossTrash = await fetch(`${origin}/kolors/trash-file?p=${encodeURIComponent(saved.body.saved.path)}`)
check('the saved file is not served by the trash route', crossTrash.status === 403, crossTrash.status)

// ---- delete it: it must move to the trash, not vanish
const removed = await call('POST', '/history/delete', { ids: [saved.body.saved.id] })
check('deleting a saved picture answers 200', removed.status === 200 && removed.body.moved === 1, JSON.stringify(removed.body))
check('the picture is gone from the save folder', !existsSync(saved.body.saved.path))

let trash = await call('GET', '/trash')
const parked = trash.body.items.find((item) => item.prompt === 'livecheck 雨夜街角')
check('it is waiting in the trash', parked !== undefined, JSON.stringify(trash.body.items.map((item) => item.prompt)))
check('the trashed file exists on disk', parked !== undefined && existsSync(parked.path))
check('the trash entry names its origin', parked?.origin === 'saved', parked?.origin)
if (parked !== undefined) created.trashIds.push(parked.id)

const trashStream = await fetch(`${origin}${parked.src}`)
check('the trash streams its own file', trashStream.ok && trashStream.headers.get('content-type') === 'image/png', trashStream.status)

// ---- restore it
const restored = await call('POST', '/trash/restore', { ids: [parked.id] })
check('restore answers 200', restored.status === 200 && restored.body.restored === 1, JSON.stringify(restored.body))
const afterRestore = await call('GET', '/history?days=0')
const back = afterRestore.body.items.find((item) => item.prompt === 'livecheck 雨夜街角')
check('the restored picture is back in history', back !== undefined)
if (back !== undefined) created.savedIds.push(back.id)
trash = await call('GET', '/trash')
check('the restored row left the trash', trash.body.items.every((item) => item.id !== parked.id))

// ---- discard the on-screen frame: it goes to the trash, never to a folder of its own
const frame2 = join(frameRoot, `live2-${Date.now()}.png`)
writeFileSync(frame2, png())
created.previews.push(frame2)
const discarded = await call('POST', '/discard', {
  file: frame2, prompt: 'livecheck 预览删除', size: '720x1280', steps: 20, guidance: 7.5, seed: 7, at: Date.now(), origin: 'preview',
})
check('discarding a frame answers 200', discarded.status === 200, JSON.stringify(discarded.body))
check('the frame left the scratch folder', !existsSync(frame2))
check('the frame is in the trash', typeof discarded.body.trashed?.path === 'string' && existsSync(discarded.body.trashed.path))
if (discarded.body.trashed !== undefined) created.trashIds.push(discarded.body.trashed.id)

// ---- purge for real
const purged = await call('POST', '/trash/purge', { ids: created.trashIds })
check('purge answers 200', purged.status === 200 && purged.body.purged >= 1, JSON.stringify(purged.body))
check('the purged files are gone from disk', created.trashIds.every((id) => {
  return trash.body.items.every((item) => item.id !== id)
}))
created.trashIds = []

// ---- guards
const foreignReveal = await call('POST', '/reveal', { path: join(home, 'secrets') })
check('revealing a foreign directory is refused', foreignReveal.status === 403, foreignReveal.status)
const foreignDiscard = await call('POST', '/discard', { file: join(home, 'dsh-kolors.json') })
check('discarding a foreign file is refused', foreignDiscard.status === 403, foreignDiscard.status)
const wildWindow = await call('GET', '/history?days=999')
check('an unsupported window is not honoured', wildWindow.status === 200 && wildWindow.body.days !== 999, wildWindow.body.days)
const oldCacheRoute = await fetch(`${origin}/kolors/cache?p=${encodeURIComponent(frame2)}`)
check('the retired preview route no longer answers', oldCacheRoute.status === 404, oldCacheRoute.status)

// ---- cleanup: nothing this script created may outlive it
for (const frame of created.previews) {
  try { const fs = await import('node:fs'); fs.rmSync(frame, { force: true }) } catch { /* gone */ }
}
const cleanup = await call('POST', '/history/delete', { ids: created.savedIds })
void cleanup
let remaining = await call('GET', '/trash')
const leftovers = remaining.body.items.filter((item) => String(item.prompt).startsWith('livecheck'))
if (leftovers.length > 0) await call('POST', '/trash/purge', { ids: leftovers.map((item) => item.id) })
remaining = await call('GET', '/trash')
check('the check leaves no trash behind', remaining.body.items.every((item) => !String(item.prompt).startsWith('livecheck')))

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exitCode = fail === 0 ? 0 : 1
