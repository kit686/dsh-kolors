/**
 * The reported bug, reproduced against the real client bundle.
 *
 * The audit file checks the shape of the source; this file runs it. A minimal
 * hook runtime stands in for React — enough of it to mount a component, re-render
 * on setState, run effects with dependency arrays, and unmount with cleanup — and
 * `client.js` is loaded through its own module-loader contract, so the code under
 * test is the code that ships.
 *
 * The scenario is the report verbatim: type a prompt, press generate, click
 * another page while the request is in flight, let the request land, come back.
 *
 * Run with: node scripts/tabswitch.mjs
 */

/* ------------------------------------------------------------------ react */

const React = (() => {
  const Fragment = Symbol('Fragment')

  let current = null
  let fibers = new Map()
  let visited = new Set()
  let dirty = false
  let rendered = []

  const depsSame = (a, b) => {
    if (a === undefined || b === undefined) return false
    if (a === null || b === null) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return false
    return true
  }

  function createElement(type, props, ...children) {
    const flat = children.length === 0 ? undefined : children.length === 1 ? children[0] : children
    return { type, props: { ...(props ?? {}), ...(flat === undefined ? {} : { children: flat }) } }
  }

  function useState(initial) {
    const fiber = current
    const index = fiber.hookIndex++
    if (fiber.hooks[index] === undefined) {
      fiber.hooks[index] = { value: typeof initial === 'function' ? initial() : initial }
    }
    const cell = fiber.hooks[index]
    const set = (next) => {
      const value = typeof next === 'function' ? next(cell.value) : next
      if (Object.is(value, cell.value)) return
      cell.value = value
      dirty = true
    }
    return [cell.value, set]
  }

  function useRef(initial) {
    const fiber = current
    const index = fiber.hookIndex++
    if (fiber.hooks[index] === undefined) fiber.hooks[index] = { ref: { current: initial } }
    return fiber.hooks[index].ref
  }

  function useCallback(fn, deps) {
    const fiber = current
    const index = fiber.hookIndex++
    const prev = fiber.hooks[index]
    if (prev === undefined || !depsSame(prev.deps, deps)) fiber.hooks[index] = { deps, fn }
    return fiber.hooks[index].fn
  }

  function useEffect(fn, deps) {
    const fiber = current
    const index = fiber.hookIndex++
    const prev = fiber.hooks[index]
    if (prev === undefined) fiber.hooks[index] = { deps, next: fn, cleanup: undefined }
    else if (!depsSame(prev.deps, deps)) { prev.deps = deps; prev.next = fn }
  }

  function walk(node, parentKey) {
    if (node === null || node === undefined || node === false || node === true) return
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${parentKey}.${i}`))
      return
    }
    if (typeof node !== 'object') return
    const { type, props } = node
    const p = props ?? {}
    if (typeof type === 'function') {
      const key = `${parentKey}:${type.name || 'anon'}`
      let fiber = fibers.get(key)
      if (fiber !== undefined && fiber.type !== type) { unmountFiber(fiber); fiber = undefined }
      if (fiber === undefined) {
        fiber = { key, type, hooks: [], hookIndex: 0, cleanups: [] }
        fibers.set(key, fiber)
      }
      visited.add(key)
      const prev = current
      current = fiber
      fiber.hookIndex = 0
      const savedCleanups = fiber.cleanups
      fiber.cleanups = []
      let out
      try { out = type(p) } finally { current = prev }
      // A cleanup registered by this render replaces the previous one for the
      // same effect slot; slots that did not re-run keep theirs.
      fiber.cleanups = savedCleanups
      walk(out, `${key}/out`)
      return
    }
    rendered.push({ type, props: p })
    walk(p.children, `${parentKey}/${String(type)}`)
  }

  function unmountFiber(fiber) {
    for (const hook of fiber.hooks) {
      if (hook !== null && typeof hook === 'object' && typeof hook.cleanup === 'function') {
        try { hook.cleanup() } catch { /* a cleanup must not break the teardown */ }
      }
    }
    fibers.delete(fiber.key)
  }

  function renderPass(root) {
    rendered = []
    visited = new Set()
    walk(root, 'root')
    for (const key of [...fibers.keys()]) {
      if (!visited.has(key)) unmountFiber(fibers.get(key))
    }
  }

  function runEffects() {
    let ran = false
    for (const fiber of fibers.values()) {
      for (const hook of fiber.hooks) {
        if (hook === null || typeof hook !== 'object' || hook.next === undefined) continue
        const fn = hook.next
        hook.next = undefined
        ran = true
        if (typeof hook.cleanup === 'function') {
          try { hook.cleanup() } catch { /* ditto */ }
        }
        const out = fn()
        hook.cleanup = typeof out === 'function' ? out : undefined
      }
    }
    return ran
  }

  /** Render, run effects, and let the resulting setState settle. */
  function flush(root, { passes = 30 } = {}) {
    for (let i = 0; i < passes; i += 1) {
      dirty = false
      renderPass(root)
      runEffects()
      if (!dirty) return
    }
    throw new Error('render did not settle')
  }

  const all = () => rendered
  const byClass = (name) => rendered.filter((node) => typeof node.props.className === 'string'
    && node.props.className.split(/\s+/).includes(name))

  return { Fragment, createElement, useState, useRef, useCallback, useEffect, flush, all, byClass }
})()

/* ------------------------------------------------------------------ hosts */

const styles = { textContent: '' }
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ dataset: {}, style: {}, textContent: '' }),
  head: { appendChild() {} },
  body: { style: {}, appendChild() {}, },
  addEventListener() {},
  removeEventListener() {},
}
globalThis.localStorage = {
  store: new Map(),
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null },
  setItem(key, value) { this.store.set(key, String(value)) },
}
globalThis.navigator ??= {}
globalThis.window = {
  __ModuleLoader__: { load(def) { globalThis.__loaded = def } },
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
}

/* ---------------------------------------------------------------- fetch */

const calls = []
let stateBody = null
/** The in-flight generation, held open so the test can land it whenever it likes. */
let inflight = null

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, blob: async () => ({}) }
}

/** Answer the request that is open, or throw if there is none. */
function finishGenerate() {
  if (inflight === null) throw new Error('no generation in flight')
  const settle = inflight
  inflight = null
  // The Host's own state now reports the allowance after this request: a real
  // `/state` read is not frozen at the pre-generate numbers.
  stateBody = { ...stateBody, quota: { ...stateBody.quota, minuteLeft: 1, dayLeft: 399 } }
  settle.resolve(jsonResponse({
    ok: true,
    record: {
      id: 'frame-1', file: 'C:\\frames\\a.png', src: '/kolors/frame?p=a', prompt: '雨夜街角',
      size: '1024x1024', steps: 20, guidance: 7.5, seed: 7, at: Date.now(),
      watermark: false, keyLabel: 'Key 1', boot: 'boot-1',
    },
    quota: { minuteLeft: 1, dayLeft: 399 },
  }))
}

function failGenerate(message, status) {
  if (inflight === null) throw new Error('no generation in flight')
  const settle = inflight
  inflight = null
  settle.resolve(jsonResponse({ ok: false, message }, status))
}

globalThis.fetch = async (url, init = {}) => {
  const method = init.method ?? 'GET'
  calls.push(`${method} ${url}`)
  if (url === '/kolors/state') return jsonResponse(stateBody)
  if (url === '/kolors/history' || url.startsWith('/kolors/history?')) {
    return jsonResponse({ ok: true, items: [], total: 0, days: 7, windows: [1, 3, 7, 30, 0] })
  }
  if (url === '/kolors/trash') return jsonResponse({ ok: true, items: [], total: 0 })
  if (url === '/kolors/settings') return jsonResponse({ ok: true })
  if (url === '/kolors/generate') {
    // Held open: this is the whole point — the request outlives the click.
    return new Promise((resolve) => { inflight = { resolve } })
  }
  return jsonResponse({ ok: false, message: 'unexpected' }, 404)
}

/* ------------------------------------------------------------- the panel */

const { readFileSync } = await import('node:fs')
const { join, dirname } = await import('node:path')
const { fileURLToPath } = await import('node:url')

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'client.js'), 'utf8')

let captured = {}
const sandboxRequire = (id) => {
  if (id === 'react') return React
  throw new Error(`unexpected require: ${id}`)
}

// Load the shipped bundle through its own contract: it calls
// `window.__ModuleLoader__.load({ id, factory })` and expects the loader to run
// the factory with a `require` bound to the browser module table.
globalThis.__loaded = null
const load = new Function('window', 'document', 'require', 'localStorage', 'module', 'exports', source)
const mod = { exports: {} }
load(globalThis.window, globalThis.document, sandboxRequire, globalThis.localStorage, mod, mod.exports)
const plugin = globalThis.__loaded.factory(sandboxRequire)

const ctx = {
  slots: {
    inject(name, cb) { cb() },
    register(options, component) {
      if (options.name === 'main') captured.main = component
      if (options.name === 'sidebar.panellist') captured.sidebar = component
      return () => {}
    },
  },
  locale: undefined,
  effect(fn) { fn() },
}
plugin.apply(ctx)

/* --------------------------------------------------------------- harness */

let pass = 0
let fail = 0
function check(label, ok, detail) {
  if (ok) { pass += 1; console.log(`  ok  ${label}`) }
  else { fail += 1; console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`) }
}
const root = React.createElement(captured.main, {})
// What is mounted at the top right now. Leaving the panel swaps this for an
// empty host, so `settle` re-renders the shell instead of bringing the page back.
let activeRoot = root
const settle = async (passes = 6) => {
  for (let i = 0; i < passes; i += 1) {
    React.flush(activeRoot)
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
  }
  React.flush(activeRoot)
}

/** Every string under a node, so a message buried in a child element still counts. */
const textOf = (node) => {
  const out = []
  const walkNode = (value) => {
    if (typeof value === 'string' || typeof value === 'number') { out.push(String(value)); return }
    if (Array.isArray(value)) { for (const child of value) walkNode(child); return }
    if (value === null || value === undefined || typeof value !== 'object') return
    walkNode(value.props?.children)
  }
  walkNode(node.props?.children)
  return out.join(' ')
}
const tab = (label) => React.byClass('dshk-tab').find((node) => textOf(node).startsWith(label))

stateBody = {
  ok: true,
  model: 'Kwai-Kolors/Kolors',
  outputDir: 'C:\\Users\\me\\Pictures',
  folder: 'C:\\Users\\me\\Pictures\\dsh-kolors-image',
  params: { size: '1024x1024', steps: 20, guidance: 7.5, negative: '', watermark: false },
  sizes: [
    { id: '1024x1024', ratio: '1:1', label: '方图' },
    { id: '960x1280', ratio: '3:4', label: '竖图' },
    { id: '768x1024', ratio: '3:4', label: '竖图 · 小' },
    { id: '720x1440', ratio: '1:2', label: '长图' },
    { id: '720x1280', ratio: '9:16', label: '手机壁纸' },
  ],
  quota: { minuteLeft: 2, dayLeft: 400, minuteLimit: 2, dayLimit: 400 },
  keys: [{ id: '1', label: 'Key 1', enabled: true, configured: true, hint: '••••1234' }],
  limits: { minute: 2, day: 400, historyDays: 7, windows: [1, 3, 7, 30, 0] },
  ready: true,
  tool: { name: 'kolors_image', state: 'active', message: '' },
  trashDir: 'C:\\Users\\me\\Pictures\\dsh-kolors-image\\dsh-kolors-trash',
  canPickFolder: true,
  preview: null,
  boot: 'boot-1',
}

await settle()

console.log('[mount]')
check('the page renders', React.byClass('dshk-page').length === 1)
check('the generate tab is the landing tab', tab('生图') !== undefined)
const cta = () => React.byClass('dshk-cta')[0]
check('the generate button is there', cta() !== undefined)
check('it is disabled while the prompt is empty', cta().props.disabled === true)

// Type a prompt.
const area = React.all().find((node) => node.type === 'textarea' && node.props.className === 'dshk-field')
check('the prompt box is there', area !== undefined)
area.props.onChange({ target: { value: '雨夜街角' } })
await settle()
check('the button enables once there is a prompt', cta().props.disabled === false)

console.log('\n[generate, then leave the page]')
cta().props.onClick()
await settle()
check('the request was sent', calls.some((c) => c === 'POST /kolors/generate'), calls.join(' | '))
check('the stage shows a spinner', React.byClass('dshk-spin').length === 1)
check('the tab strip shows the job running', React.byClass('dshk-ring').length >= 1)

// The user clicks History while the request is still open.
tab('历史').props.onClick()
await settle()
check('the history page is on screen', React.byClass('dshk-hist').length === 1)
check('the generate body is unmounted', React.byClass('dshk-cta').length === 0)

// The Host finishes; nobody is looking at the generate tab.
check('the request is still pending', inflight !== null)
finishGenerate()
await settle()

console.log('\n[back to the generate tab]')
check('the tab strip marks the finished frame', React.byClass('dshk-dot').length === 1)
tab('生图').props.onClick()
await settle()

const image = React.all().find((node) => node.type === 'img' && String(node.props.src).includes('/kolors/frame'))
check('the picture is on the stage after returning', image !== undefined, React.all().filter((n) => n.type === 'img').map((n) => n.props.src).join(','))
check('the spinner is gone', React.byClass('dshk-spin').length === 0)
check('the dot is cleared once seen', React.byClass('dshk-dot').length === 0)
check('the save and delete buttons came back with it', React.byClass('dshk-stagefoot').length === 1)
check('no frame was thrown away', !calls.includes('POST /kolors/discard'), calls.join(' | '))
check('the quota meter took the new numbers', React.byClass('dshk-meter').some((node) => textOf(node).includes('399')), React.byClass('dshk-meter').map(textOf).join(' | '))

console.log('\n[a failure lands on the returning tab too]')
// Start a second generation from the generate tab, then leave again.
React.byClass('dshk-cta')[0].props.onClick()
await settle()
check('a second request is in flight', inflight !== null)
tab('历史').props.onClick()
await settle()
// The Host answers with an error while the history page is on screen.
failGenerate('平台级限流（429），这个账号这一分钟已经出过 2 张，等一分钟再来。', 429)
await settle()
tab('生图').props.onClick()
await settle()
check('the error is shown after coming back', React.byClass('dshk-err').length === 1)
check('the error names the cause', React.byClass('dshk-err').some((node) => textOf(node).includes('429')), React.byClass('dshk-err').map(textOf).join(' | '))
check('the generate button is usable again', React.byClass('dshk-cta')[0].props.disabled === false)

console.log('\n[leaving the whole panel, not just the tab]')
// The sidebar row is a different page in the same shell: clicking it unmounts
// KolorsPage entirely, which is the most complete form of "I clicked elsewhere".
// The request and the frame still have to survive that.
React.byClass('dshk-cta')[0].props.onClick()
await settle()
check('a third request is in flight', inflight !== null)

// Tear the whole page down, then bring it back up — a different component
// instance, the same module scope.
activeRoot = React.createElement('div', null)
await settle()
check('the panel is gone', React.byClass('dshk-page').length === 0)

stateBody = { ...stateBody, quota: { ...stateBody.quota, minuteLeft: 0, dayLeft: 398 } }
finishGenerate()
await settle()

// Re-mount: a brand new KolorsPage, reading the same STAGE.
activeRoot = root
await settle()
check('the page is back', React.byClass('dshk-page').length === 1)
const imageAfterRemount = React.all().find((node) => node.type === 'img' && String(node.props.src).includes('/kolors/frame'))
check('the picture survived leaving the whole panel', imageAfterRemount !== undefined, React.all().filter((n) => n.type === 'img').map((n) => n.props.src).join(','))
check('the save button is offered for it', React.byClass('dshk-stagefoot').length === 1)

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exitCode = fail === 0 ? 0 : 1
