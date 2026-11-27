/**
 * Offline checks for the Host half: key pool bookkeeping, quota windows,
 * save/history/discard paths, and the route handler wiring. No network: the
 * generation path is exercised only up to its pre-flight refusal.
 *
 * Run with: node scripts/selftest.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const home = mkdtempSync(join(tmpdir(), 'kolors-home-'))
process.env.DSH_HOME = home

const outDir = join(home, 'Pictures')
mkdirSync(outDir, { recursive: true })

const bundle = pathToFileURL(join(import.meta.dirname, '..', 'index.js')).href
const { createHandler, apply, MODEL, SIZES } = await import(bundle)

let pass = 0
let fail = 0
function check(label, condition, detail) {
  if (condition) { pass += 1; console.log(`  ok  ${label}`) }
  else { fail += 1; console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`) }
}

/** A fake IncomingMessage over a JSON body. */
function req(method, url, body) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
  return {
    method,
    url,
    headers: { host: '127.0.0.1:4969' },
    async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk },
  }
}

/** A fake ServerResponse that records status and body. */
function res() {
  const state = { status: 0, headers: {}, body: '', chunks: [] }
  return {
    state,
    writeHead(status, headers) { state.status = status; Object.assign(state.headers, headers ?? {}) },
    end(value) {
      if (value === undefined) { state.body = ''; return }
      if (typeof value === 'string' || Buffer.isBuffer(value)) state.body = String(value)
      else { state.body = Buffer.concat(state.chunks).toString('binary') }
    },
    write(chunk) { state.chunks.push(Buffer.from(chunk)); return true },
  }
}

const handler = createHandler()
async function call(method, path, body) {
  const response = res()
  await handler(req(method, `/kolors${path}`, body), response)
  let parsed
  try { parsed = JSON.parse(response.state.body) } catch { parsed = undefined }
  return { status: response.state.status, headers: response.state.headers, body: parsed, raw: response.state }
}

/** The Host's own boot id, read through the public state route. */
async function bootId() {
  const current = await call('GET', '/state')
  return current.body.boot
}

/**
 * The scratch folder the Host keeps the on-screen frame in. The panel never
 * shows this path; the fixtures write here exactly the way `generate()` does.
 */
const frameDir = join(home, 'kolors-frames')
mkdirSync(frameDir, { recursive: true })

/** Read the plugin's own settings file, for scenarios that need a seeded row. */
function readSettingsFile() {
  try { return JSON.parse(readFileSync(join(home, 'dsh-kolors.json'), 'utf8')) } catch { return {} }
}

console.log(`\nmodel: ${MODEL}`)
check('model is hard-locked to Kolors', MODEL === 'Kwai-Kolors/Kolors')

console.log('\n[state — empty profile]')
{
  const first = await call('GET', '/state')
  check('state answers 200', first.status === 200, first.status)
  check('no keys yet', first.body.keys.length === 0)
  check('default output dir is the user Pictures folder', first.body.outputDir.endsWith('Pictures'), first.body.outputDir)
  check('save folder is dsh-kolors-image', first.body.folder.endsWith('dsh-kolors-image'), first.body.folder)
  check('five canvas options ship', first.body.sizes.length === 5 && SIZES.length === 5)
  check('an empty pool leaves no allowance', first.body.quota.dayLeft === 0, first.body.quota.dayLeft)
  check('the day ceiling is still reported', first.body.quota.dayLimit === 400, first.body.quota.dayLimit)
}

console.log('\n[generate before a key exists]')
{
  const refused = await call('POST', '/generate', { prompt: 'a cat' })
  check('refused with 400', refused.status === 400, refused.status)
  check('message names the Key tab', /Key/.test(refused.body.message), refused.body.message)
}

console.log('\n[key pool]')
{
  const added = await call('POST', '/key', { action: 'add', value: 'sk-first-1234', label: '主号' })
  check('add answers 200', added.status === 200, JSON.stringify(added.body))
  check('pool now holds one key', added.body.keys.length === 1)
  check('key is masked to four characters', added.body.keys[0].hint === '••••1234', added.body.keys[0].hint)
  check('key is configured', added.body.keys[0].configured === true)

  const second = await call('POST', '/key', { action: 'add', value: 'sk-second-9876' })
  check('second key gets a fresh id', second.body.keys.length === 2 && second.body.keys[1].id === '2', JSON.stringify(second.body.keys.map((k) => k.id)))
  check('quota doubles with two live keys', second.body.quota.dayLimit === 800, second.body.quota.dayLimit)

  const bad = await call('POST', '/key', { action: 'add', value: 'sk with space' })
  check('a key with whitespace is refused', bad.status === 400, bad.status)

  const off = await call('POST', '/key', { action: 'update', id: '2', enabled: false })
  check('disable takes effect', off.body.keys[1].enabled === false)
  check('a disabled key leaves the pool total', off.body.quota.dayLimit === 400, off.body.quota.dayLimit)

  const on = await call('POST', '/key', { action: 'update', id: '2', enabled: true })
  check('enable restores it', on.body.keys[1].enabled === true && on.body.quota.dayLimit === 800)

  const swapped = await call('POST', '/key', { action: 'update', id: '1', value: 'sk-rotated-0000' })
  check('replacing a key re-masks it', swapped.body.keys[0].hint === '••••0000', swapped.body.keys[0].hint)
}

console.log('\n[settings]')
{
  const saved = await call('POST', '/settings', {
    outputDir: outDir,
    params: { size: '720x1440', steps: 34, guidance: 9.5, negative: 'blurry', watermark: true },
  })
  check('output dir persists', saved.body.outputDir === outDir, saved.body.outputDir)
  check('params persist', saved.body.params.size === '720x1440' && saved.body.params.steps === 34)
  check('watermark flag persists', saved.body.params.watermark === true)

  const clamped = await call('POST', '/settings', { params: { size: 'nope', steps: 500, guidance: 99 } })
  check('unknown canvas falls back to 1024x1024', clamped.body.params.size === '1024x1024', clamped.body.params.size)
  check('steps clamp to 50', clamped.body.params.steps === 50, clamped.body.params.steps)
  check('guidance clamps to 20', clamped.body.params.guidance === 20, clamped.body.params.guidance)

  const relative = await call('POST', '/settings', { outputDir: 'Pictures' })
  check('a relative output dir is refused', relative.status === 400, relative.status)
}

console.log('\n[save / history / discard]')
{
  const cached = join(frameDir, 'frame.png')
  writeFileSync(cached, 'fake-png-bytes')

  const saved = await call('POST', '/save', {
    file: cached, prompt: '雨夜街角', size: '1024x1024', steps: 20, guidance: 7.5, seed: 42, at: Date.now(), keyLabel: '主号',
  })
  check('save answers 200', saved.status === 200, JSON.stringify(saved.body))
  check('file lands in dsh-kolors-image', saved.body.saved.path.includes('dsh-kolors-image'), saved.body.saved.path)
  check('copied file exists', existsSync(saved.body.saved.path))
  check('the pending frame is gone after saving', !existsSync(cached))
  check('index file exists', existsSync(join(outDir, 'dsh-kolors-image', 'index.json')))

  const hist = await call('GET', '/history')
  check('history lists the saved picture', hist.body.items.length === 1, hist.body.items.length)
  check('history item carries a src url', typeof hist.body.items[0].src === 'string' && hist.body.items[0].src.startsWith('/kolors/saved'))
  check('history reports its windows', Array.isArray(hist.body.windows) && hist.body.windows.join() === '1,3,7,30,0')

  const stream = await call('GET', `/saved?p=${encodeURIComponent(saved.body.saved.path)}`)
  check('saved picture streams as image/png', stream.raw.headers['content-type'] === 'image/png', stream.raw.headers['content-type'])

  const escape = await call('GET', `/saved?p=${encodeURIComponent(join(frameDir, 'frame.png'))}`)
  check('a path outside the save folder is refused', escape.status === 403, escape.status)

  const badDiscard = await call('POST', '/discard', { file: join(home, 'index.json') })
  check('discard refuses a foreign path', badDiscard.status === 403, badDiscard.status)

  const thrown = join(frameDir, 'throw-me.png')
  writeFileSync(thrown, 'fake-png-bytes')
  const discard = await call('POST', '/discard', { file: thrown, prompt: '雨夜街角', size: '1024x1024' })
  check('discard moves the frame out of the scratch folder', discard.status === 200 && !existsSync(thrown))
  check('discard keeps the bytes in the trash', typeof discard.body.trashed?.path === 'string' && existsSync(discard.body.trashed.path), JSON.stringify(discard.body))

  const trashed = await call('GET', '/trash')
  check('the trash lists the discarded preview', trashed.body.items.some((item) => item.prompt === '雨夜街角' || item.origin === 'preview'), trashed.body.items.length)
  check('the trash folder sits under the save folder', String(trashed.body.folder).includes('dsh-kolors-image'), trashed.body.folder)

  const removed = await call('POST', '/history/delete', { id: hist.body.items[0].id })
  check('history delete answers 200', removed.status === 200)
  const after = await call('GET', '/history')
  check('the deleted picture leaves history', (after.body.items ?? []).every((item) => item.id !== hist.body.items[0].id))
  const trashedAgain = await call('GET', '/trash')
  check('a deleted saved picture lands in the trash', trashedAgain.body.items.some((item) => item.origin === 'saved'), JSON.stringify(trashedAgain.body.items.map((item) => item.origin)))
  check('nothing was unlinked yet: both trash files exist', trashedAgain.body.items.every((item) => existsSync(item.path)))
}

console.log('\n[batch delete, restore, purge]')
{
  // Three pictures through the same pipeline, then a multi-id delete.
  const ids = []
  for (let index = 0; index < 3; index += 1) {
    const frame = join(frameDir, `batch-${index}.png`)
    writeFileSync(frame, `bytes-${index}`)
    const saved = await call('POST', '/save', { file: frame, prompt: `batch ${index}`, size: '1024x1024', at: Date.now() + index })
    ids.push(saved.body.saved.id)
  }
  const before = await call('GET', '/history')
  check('three pictures are in history', before.body.items.filter((item) => item.prompt.startsWith('batch')).length === 3)

  const batch = await call('POST', '/history/delete', { ids })
  check('a multi-id delete moves all three', batch.body.moved === 3, JSON.stringify(batch.body))
  const afterDelete = await call('GET', '/history')
  check('history no longer lists them', afterDelete.body.items.filter((item) => item.prompt.startsWith('batch')).length === 0)

  const trashList = await call('GET', '/trash')
  const batchTrash = trashList.body.items.filter((item) => item.prompt.startsWith('batch'))
  check('all three are in the trash', batchTrash.length === 3, batchTrash.length)
  check('each trash row has an id and a src', batchTrash.every((item) => typeof item.id === 'string' && String(item.src).startsWith('/kolors/trash-file')))

  const one = await call('POST', '/trash/restore', { ids: [batchTrash[0].id] })
  check('restore answers 200', one.status === 200 && one.body.restored === 1, JSON.stringify(one.body))
  const afterRestore = await call('GET', '/history')
  check('the restored picture is back in history', afterRestore.body.items.some((item) => item.prompt === batchTrash[0].prompt))
  const trashAfterRestore = await call('GET', '/trash')
  check('the restored row left the trash', trashAfterRestore.body.items.every((item) => item.id !== batchTrash[0].id))

  const purgeOne = await call('POST', '/trash/purge', { ids: [batchTrash[1].id] })
  check('purging one answers 200', purgeOne.status === 200 && purgeOne.body.purged === 1, JSON.stringify(purgeOne.body))
  check('the purged file is gone from disk', !existsSync(batchTrash[1].path))

  const purgeAll = await call('POST', '/trash/purge', { all: true })
  check('empty-the-trash answers 200', purgeAll.status === 200, JSON.stringify(purgeAll.body))
  const emptyTrash = await call('GET', '/trash')
  check('the trash is empty afterwards', emptyTrash.body.items.length === 0, emptyTrash.body.items.length)

  const noTarget = await call('POST', '/trash/purge', {})
  check('a purge with no target is refused', noTarget.status === 400, noTarget.status)
}

console.log('\n[history windows]')
{
  const settings = await call('POST', '/settings', { historyDays: 3 })
  check('the window setting persists', settings.body.limits.historyDays === 3, settings.body.limits.historyDays)
  const threeDays = await call('GET', '/history')
  check('the saved window is the default for reads', threeDays.body.days === 3, threeDays.body.days)
  const oneDay = await call('GET', '/history?days=1')
  check('a one-day window can be requested', oneDay.body.days === 1, oneDay.body.days)
  const all = await call('GET', '/history?days=0')
  check('zero means everything', all.body.days === 0, all.body.days)
  const bogus = await call('GET', '/history?days=999')
  check('an unsupported window falls back to the saved one', bogus.body.days === 3, bogus.body.days)
  const rejected = await call('POST', '/settings', { historyDays: 12 })
  check('an unsupported window is refused on write', rejected.status === 400, rejected.status)
  await call('POST', '/settings', { historyDays: 7 })
}

console.log('\n[reveal guard]')
{
  const outside = await call('POST', '/reveal', { path: join(home, 'secrets') })
  check('revealing a foreign directory is refused', outside.status === 403, outside.status)
  const missing = await call('POST', '/reveal', { path: '' })
  check('revealing nothing is refused', missing.status === 403, missing.status)
}

console.log('\n[the frame survives a tab switch]')
{
  // The frame must come back on the next state read, and saving or deleting it
  // must clear the pointer so a stale picture never reappears.
  const boot = await bootId()
  const frame = join(frameDir, 'keep-me.png')
  writeFileSync(frame, 'preview-bytes')
  const stored = readSettingsFile()
  stored.lastPreview = { id: 'p1', file: frame, src: '/kolors/frame', prompt: '预览', size: '1024x1024', at: Date.now(), boot }
  writeFileSync(join(home, 'dsh-kolors.json'), JSON.stringify(stored, null, 2))

  const withPreview = await call('GET', '/state')
  check('state hands the last frame back', withPreview.body.preview?.file === frame, JSON.stringify(withPreview.body.preview))
  check('the state does not advertise a preview folder', withPreview.body.cacheDir === undefined, withPreview.body.cacheDir)

  const served = await call('GET', `/frame?p=${encodeURIComponent(frame)}`)
  check('the frame streams from the scratch folder', served.raw.headers['content-type'] === 'image/png', served.raw.headers['content-type'])

  const savedIt = await call('POST', '/save', { file: frame, prompt: '预览', size: '1024x1024' })
  check('saving answers 200', savedIt.status === 200)
  check('saving removes the scratch copy', !existsSync(frame))
  const afterSave = await call('GET', '/state')
  check('saving keeps the frame on screen, now pointing at the filed copy', afterSave.body.preview?.filed === true, JSON.stringify(afterSave.body.preview))
  check('the filed frame points inside the save folder', String(afterSave.body.preview?.file).includes('dsh-kolors-image'), afterSave.body.preview?.file)
  check('the filed frame is still on disk', existsSync(afterSave.body.preview?.file ?? ''))
  await call('POST', '/history/delete', { ids: [savedIt.body.saved.id] })
  const trash = await call('GET', '/trash')
  await call('POST', '/trash/purge', { ids: trash.body.items.map((item) => item.id) })
  const afterDelete = await call('GET', '/state')
  check('deleting the filed picture clears the frame', afterDelete.body.preview === null, JSON.stringify(afterDelete.body.preview))

  // A tool call has no browser stage: it must leave the stage alone rather than
  // pointing it at a picture the panel never drew.
  const toolFrame = join(frameDir, 'tool-frame.png')
  writeFileSync(toolFrame, 'tool-bytes')
  const toolSaved = await call('POST', '/save', { file: toolFrame, prompt: '工具出的', size: '1024x1024', stage: false })
  check('a staged-false save still files the picture', toolSaved.status === 200 && existsSync(toolSaved.body.saved.path))
  const afterTool = await call('GET', '/state')
  check('a tool save does not take over the stage', afterTool.body.preview === null, JSON.stringify(afterTool.body.preview))
  await call('POST', '/history/delete', { ids: [toolSaved.body.saved.id] })
  const toolTrash = await call('GET', '/trash')
  await call('POST', '/trash/purge', { ids: toolTrash.body.items.map((item) => item.id) })

  // A pointer whose file vanished must not survive a read.
  const again = readSettingsFile()
  again.lastPreview = { id: 'p2', file: join(frameDir, 'gone.png'), prompt: '不在', at: Date.now(), boot }
  writeFileSync(join(home, 'dsh-kolors.json'), JSON.stringify(again, null, 2))
  const missing = await call('GET', '/state')
  check('a frame whose file is gone is dropped', missing.body.preview === null, JSON.stringify(missing.body.preview))

  // Deleting the frame parks it in the trash and clears the pointer.
  const frame2 = join(frameDir, 'delete-me.png')
  writeFileSync(frame2, 'preview-bytes-2')
  const set2 = readSettingsFile()
  set2.lastPreview = { id: 'p3', file: frame2, prompt: '删掉', at: Date.now(), boot }
  writeFileSync(join(home, 'dsh-kolors.json'), JSON.stringify(set2, null, 2))
  const gone = await call('POST', '/discard', { file: frame2, prompt: '删掉', size: '1024x1024', origin: 'preview' })
  check('discard answers 200', gone.status === 200)
  const afterDiscard = await call('GET', '/state')
  check('deleting clears the frame pointer', afterDiscard.body.preview === null, JSON.stringify(afterDiscard.body.preview))
  const trash2 = await call('GET', '/trash')
  check('deleting the frame puts it in the trash', (trash2.body.items ?? []).some((item) => item.prompt === '删掉'), JSON.stringify(trash2.body.items.map((item) => item.prompt)))
  await call('POST', '/trash/purge', { ids: trash2.body.items.map((item) => item.id) })
}

console.log('\n[a restart clears the frame and the draft]')
{
  // A pointer stamped with a different boot id belongs to a previous run: the
  // panel must not resurrect it, because the app was closed in between.
  const frame = join(frameDir, 'stale-run.png')
  writeFileSync(frame, 'stale-bytes')
  const stored = readSettingsFile()
  stored.lastPreview = { id: 'p9', file: frame, prompt: '上一次运行', at: Date.now(), boot: 'some-previous-process' }
  writeFileSync(join(home, 'dsh-kolors.json'), JSON.stringify(stored, null, 2))

  const afterRestart = await call('GET', '/state')
  check('a frame from a previous run is not restored', afterRestart.body.preview === null, JSON.stringify(afterRestart.body.preview))
  check('the boot id is published for the draft stamp', typeof afterRestart.body.boot === 'string' && afterRestart.body.boot !== '', afterRestart.body.boot)
  const second = await call('GET', '/state')
  check('the boot id is stable inside one process', second.body.boot === afterRestart.body.boot)
}

console.log('\n[a restart retires the leftovers]')
{
  // A frame the previous run never saved, plus the per-day cache folder an older
  // build wrote. Both must end up in the trash instead of vanishing.
  mkdirSync(join(home, 'kolors-cache', '2026-01-01'), { recursive: true })
  const legacy = join(home, 'kolors-cache', '2026-01-01', 'old-build.png')
  writeFileSync(legacy, 'legacy-bytes')
  const lingered = join(frameDir, 'lingered.png')
  writeFileSync(lingered, 'lingered-bytes')

  apply({ inject(names, run) {
    const services = {}
    for (const name of names) services[name] = { register() { return () => {} } }
    run({ ...services, effect(run) { return run() }, get() { return undefined } })
  } })

  const after = await call('GET', '/trash')
  check('the frame left by the previous run is in the trash', after.body.items.some((item) => item.prompt === '上一次运行' || String(item.path).includes('lingered')), JSON.stringify(after.body.items.map((item) => item.path)))
  check('a frame from the old cache folder is kept, not abandoned', after.body.items.some((item) => String(item.origin) === 'preview'))
  check('the old cache folder is gone', !existsSync(join(home, 'kolors-cache')))
  const purged = await call('POST', '/trash/purge', { all: true })
  check('the retirement can be undone by clearing the trash', purged.status === 200)
}

console.log('\n[cross-site refusal]')
{
  const response = res()
  await handler(
    { method: 'GET', url: '/kolors/state', headers: { host: '127.0.0.1:4969', origin: 'https://evil.example' }, async *[Symbol.asyncIterator]() {} },
    response,
  )
  check('a foreign origin is refused', response.state.status === 403, response.state.status)
}

console.log('\n[plugin shape]')
{
  check('apply is a function', typeof apply === 'function')
  const routes = []
  const tools = []
  const ctx = {
    inject(names, run) {
      const services = {}
      for (const name of names) services[name] = name === 'webServer'
        ? { register(route) { routes.push(route); return () => {} } }
        : { register(definition) { tools.push(definition); return () => {} } }
      run({ ...services, effect(run) { return run() }, get() { return undefined } })
    },
  }
  apply(ctx)
  check('one /kolors prefix route is registered', routes.length === 1 && routes[0].path === '/kolors' && routes[0].kind === 'prefix', JSON.stringify(routes.map((r) => r.path)))
  check('one kolors_image tool is registered', tools.length === 1 && tools[0].name === 'kolors_image', JSON.stringify(tools.map((tool) => tool.name)))

  const tool = tools[0]
  check('the tool has no model parameter', tool.parameters.properties.model === undefined)
  check('the tool declares prompt as required', Array.isArray(tool.parameters.required) && tool.parameters.required.includes('prompt'))
  check('the tool enumerates the five canvases', (tool.parameters.properties.size.enum ?? []).length === 5)

  // The registry rejects a property node carrying `required`, so every nested
  // node must be free of it before install.
  const illegal = []
  const walk = (node, at) => {
    if (node === null || typeof node !== 'object') return
    if (Object.hasOwn(node, 'required') && typeof node.required !== 'string' && !Array.isArray(node.required)) illegal.push(at)
    if (Array.isArray(node.required) && node.type !== 'object') illegal.push(`${at}: required[] on a non-object`)
    for (const [key, value] of Object.entries(node.properties ?? {})) walk(value, `${at}.properties.${key}`)
    if (node.items !== undefined) walk(node.items, `${at}.items`)
    if (Array.isArray(node.oneOf)) node.oneOf.forEach((branch, index) => walk(branch, `${at}.oneOf[${index}]`))
  }
  walk(tool.parameters, 'parameters')
  walk(tool.output.schema, 'output.schema')
  check('no schema node carries a property-level required flag', illegal.length === 0, illegal.join(', '))

  const required = tool.output.schema.required ?? []
  check('every required output name is declared', required.every((name) => Object.hasOwn(tool.output.schema.properties, name)), required.join(','))
}

console.log('\n[tool output rendering]')
{
  const holder = {}
  apply({ inject(names, run) {
    const services = {}
    for (const name of names) services[name] = name === 'webServer'
      ? { register() { return () => {} } }
      : { register(definition) { holder.tool = definition; return () => {} } }
    run({ ...services, effect(run) { return run() }, get() { return undefined } })
  } })
  const blocks = holder.tool.output.render(
    { prompt: 'a cat' },
    { path: join(home, 'x.png'), size: '1024x1024', prompt: 'a cat', minuteLeft: 1, dayLeft: 399, seed: 7 },
  )
  check('render returns a text block', blocks[0]?.type === 'text' && /Kwai-Kolors\/Kolors/.test(blocks[0].text))
  const withImage = holder.tool.output.render(
    { prompt: 'a cat' },
    { path: 'x', size: '1024x1024', prompt: 'a cat', minuteLeft: 1, dayLeft: 399, image: { attachmentId: 'a', mediaType: 'image/png', bytes: 1, width: 8, height: 8 } },
  )
  check('an accepted attachment adds an image block', withImage.length === 2 && withImage[1].type === 'image')
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
