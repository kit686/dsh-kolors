/**
 * Static checks for the browser half. It does not execute React: the bundle's
 * correctness is verified in the running page, so this file only asserts the
 * things a text audit can prove — the module shape, that every identifier it
 * calls is defined, that every `t()` key exists in both dictionaries, that the
 * CSS references only theme tokens the host publishes, and that no forbidden
 * Harness Client package is required.
 *
 * Run with: node scripts/clientaudit.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(import.meta.dirname, '..', 'client.js'), 'utf8')

let pass = 0
let fail = 0
const check = (label, ok, detail) => {
  if (ok) { pass += 1; console.log(`  ok  ${label}`) }
  else { fail += 1; console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`) }
}

console.log('\n[module shape]')
check('registers through the module loader', /window\.__ModuleLoader__\.load\(\{/.test(source))
check('declares the package id', /id:\s*'dsh-kolors'/.test(source))
check('exports name and apply', /exports\.name = 'dsh-kolors'/.test(source) && /exports\.apply = apply/.test(source))
check('injects slots and locale', /exports\.inject = \['slots', 'locale'\]/.test(source))
check('requires only react from the baseline table', (() => {
  const requires = [...source.matchAll(/require\('([^']+)'\)/g)].map((match) => match[1])
  return requires.length > 0 && requires.every((id) => id === 'react')
})(), [...source.matchAll(/require\('([^']+)'\)/g)].map((match) => match[1]).join(','))
check('imports no Harness client package', !/@deepseek-ai\/dsh-client-ui/.test(source))

console.log('\n[registrations]')
check('registers the sidebar row', /name: 'sidebar\.panellist'/.test(source) && /id: PANEL_ID/.test(source))
check('registers the main page', /name: 'main'/.test(source) && /key: PANEL_ID/.test(source))
check('the label follows the active locale', /label: \(\) => t\('panel'\)/.test(source))
check('the sidebar row is named Kolors生图', /\n {8}panel: 'Kolors生图',/.test(source), 'zh panel label')
check('the English row keeps its own name', /\n {8}panel: 'Kolors Image',/.test(source), 'en panel label')

console.log('\n[identifiers]')
// Every `h(...)`/helper identifier referenced must be declared somewhere in the
// module: a typo here is exactly what an unrun build would hide.
const declared = new Set()
for (const match of source.matchAll(/(?:^|\s)(?:function|const|let)\s+([A-Za-z_$][\w$]*)/g)) declared.add(match[1])
const used = new Set()
for (const match of source.matchAll(/(?:^|[^\w.$])h\(([A-Z][\w$]*)/g)) used.add(match[1])
for (const match of source.matchAll(/React\.use[A-Za-z]+/g)) used.add('React')
const unknown = [...used].filter((name) => !declared.has(name) && !['React', 'Fragment'].includes(name))
check('every component referenced as h(X) is declared', unknown.length === 0, unknown.join(', '))

console.log('\n[copy]')
const copyStart = source.indexOf('const COPY = {')
const copyEnd = source.indexOf('let t = (key, params)')
const copyBlock = source.slice(copyStart, copyEnd)
const zhBlock = copyBlock.slice(0, copyBlock.indexOf('      en: {'))
const enBlock = copyBlock.slice(copyBlock.indexOf('      en: {'))
const keysOf = (block) => new Set([...block.matchAll(/'([A-Za-z0-9_.]+)':/g)].map((match) => match[1]))
const zhKeys = keysOf(zhBlock)
const enKeys = keysOf(enBlock)
check('zh and en define the same keys', zhKeys.size === enKeys.size, `zh=${zhKeys.size} en=${enKeys.size}`)
const missingZh = [...enKeys].filter((key) => !zhKeys.has(key))
const missingEn = [...zhKeys].filter((key) => !enKeys.has(key))
check('no key is missing from zh', missingZh.length === 0, missingZh.join(','))
check('no key is missing from en', missingEn.length === 0, missingEn.join(','))
check('placeholders agree per key', (() => {
  const read = (block) => {
    const map = new Map()
    for (const match of block.matchAll(/'([A-Za-z0-9_.]+)':\s*'((?:[^'\\]|\\.)*)'/g)) map.set(match[1], match[2])
    return map
  }
  const zh = read(zhBlock)
  const en = read(enBlock)
  for (const [key, value] of zh) {
    const a = [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',')
    const b = [...String(en.get(key) ?? '').matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',')
    if (a !== b) return false
  }
  return true
})())
// `t('...')` inside a JSX-free h() call, or a helper default; a DOM tag name
// such as t('textarea') does not exist, so only calls on translated labels count.
const referenced = new Set(
  [...source.matchAll(/\bt\('([a-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*)'/g)].map((match) => match[1]),
)
const dynamic = new Set(['tab.generate', 'tab.history', 'tab.key'])
const unresolved = [...referenced]
  .filter((key) => !zhKeys.has(key) && !dynamic.has(key) && !key.startsWith('size.'))
  .filter((key) => key.includes('.') || zhKeys.has(key) === false && /^[a-z]+$/.test(key))
check('every t() key is defined', unresolved.filter((key) => zhKeys.has(key) === false && (key.includes('.') || !/^(main|style|textarea|title|subtitle|panel|generate|save|delete)$/.test(key))).length === 0, unresolved.join(','))
check('every canvas has a zh nickname', ['1024x1024', '960x1280', '768x1024', '720x1440', '720x1280']
  .every((size) => zhKeys.has(`size.${size}`)))

console.log('\n[theme tokens]')
// The tokens the shipped theme actually publishes (aliases plus the semantic
// state family); an unknown token would silently fall back to its literal.
const HOST_TOKENS = new Set([
  'bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-layer-3', 'bg-layer-4', 'bg-overlay', 'bg-mask-1',
  'border-l1', 'border-l2', 'border-l3', 'border-l4', 'border-selected',
  'label-primary', 'label-primary-foreground', 'label-secondary', 'label-tertiary', 'label-caption',
  'label-on-color', 'label-dimmed', 'label-error', 'brand-primary', 'brand-text',
  'button-primary-fill', 'button-primary-hover', 'button-primary-dimmed', 'button-contrast-fill',
  'state-error-primary', 'state-error-secondary', 'state-success-primary', 'state-success-secondary',
  'state-warn-primary', 'state-warn-secondary', 'state-idle-primary', 'state-done-primary',
  'state-business-primary', 'interactive-bg-hover', 'interactive-bg-active', 'card-fill', 'link',
])
const cssStart = source.indexOf('const CSS = `')
const cssEnd = source.indexOf('`\n', cssStart + 20)
const css = source.slice(cssStart, cssEnd)
const tokens = new Set([...css.matchAll(/var\(--dsw-alias-([a-z0-9-]+)/g)].map((match) => match[1]))
const unknownTokens = [...tokens].filter((token) => !HOST_TOKENS.has(token))
check('the stylesheet names a nonempty token set', tokens.size > 0, tokens.size)
check('every token exists in the shipped theme', unknownTokens.length === 0, unknownTokens.join(','))
// Anything outside the alias family must be a documented host variable.
const otherVars = new Set([...css.matchAll(/var\(--((?!dsw-alias-)[a-z0-9-]+)/g)].map((match) => match[1]))
const KNOWN_HOST_VARS = new Set(['dsh-frame-top-clearance', 'dsw-font-family'])
const unknownVars = [...otherVars].filter((name) => !KNOWN_HOST_VARS.has(name))
check('other custom properties are host-declared', unknownVars.length === 0, unknownVars.join(','))
// A literal colour in a control surface would not follow the theme. The
// documented `var(--token, #fallback)` defaults are allowed; a bare colour is
// not, except inside the zoom overlay, which is a fixed dark lightbox.
const FALLBACKS = /^#(0f1115|81858c|61666b|adb2b8|fff|f2f3f5|b4610f|2f7d5c|c0392b|b0362a|ff9d92)$/i
// The zoom overlay is a fixed lightbox, so its own dark palette is allowed to
// name literal colours; every other surface must go through a token.
const overlayStart = css.indexOf('.dshk-zoom {')
const overlayEnd = css.indexOf('.dshk-hist {')
const overlay = css.slice(overlayStart, overlayEnd)
const themed = css.slice(0, overlayStart) + css.slice(overlayEnd)
const declarations = themed.split('\n')
const strayLines = []
for (const line of declarations) {
  // Strip the allowed fallback position first.
  const stripped = line.replace(/var\(--[a-z0-9-]+,\s*[^)]+\)/g, 'var()')
  for (const match of stripped.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    if (!FALLBACKS.test(match[0])) strayLines.push(`${match[0]} in "${line.trim().slice(0, 70)}"`)
  }
  // rgb()/rgba() literals are only acceptable for translucent overlays.
  for (const match of stripped.matchAll(/rgba?\([^)]*\)/g)) {
    if (!/rgba\(/.test(match[0])) strayLines.push(`${match[0]} in "${line.trim().slice(0, 70)}"`)
  }
}
check('no untokenized colour in a themed surface', strayLines.length === 0, strayLines.join(' | '))
check('the fixed lightbox keeps its own palette', overlay.length > 0 && /rgba\(8,\s*9,\s*11/.test(overlay))

console.log('\n[hooks discipline]')
// An effect must declare a dependency array; without one it resubscribes on
// every render. Both the multi-line and the single-line call shapes count.
const effectCalls = [...source.matchAll(/React\.useEffect\(/g)].length
const depsPatterns = [
  /React\.useEffect\([\s\S]*?\n {6}\}, \[[^\]]*\]\)/g,
  /React\.useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\)/g,
  /React\.useEffect\(\(\) => \(\) => \{[\s\S]*?\}, \[[^\]]*\]\)/g,
  /React\.useEffect\(\(\) => [^\n]*\}, \[[^\]]*\]\)/g,
]
const seen = new Set()
for (const pattern of depsPatterns) {
  for (const match of source.matchAll(pattern)) seen.add(match.index)
}
check('every effect declares a dependency array', effectCalls > 0 && seen.size === effectCalls, `${seen.size}/${effectCalls}`)
check('a keydown listener is always removed', (() => {
  const adds = [...source.matchAll(/document\.addEventListener\('keydown'/g)].length
  const removes = [...source.matchAll(/document\.removeEventListener\('keydown'/g)].length
  return adds > 0 && adds === removes
})(), 'add/remove mismatch')
// localStorage writes belong inside an effect or an event handler, never in the
// render body. Exactly one function performs the write, and the page effect that
// keeps it current is the only place that calls it on change.
const storageWrites = [...source.matchAll(/localStorage\.setItem/g)].length
const draftWriters = [...source.matchAll(/function writeDraft\(/g)].length
const guardedWrites = [...source.matchAll(/React\.useEffect\(\(\) => \{\n {8}if \(!adopted\.current \|\| bootRef\.current === ''\) return\n {8}writeDraft\(/g)].length
check('exactly one function writes the draft', storageWrites === 1 && draftWriters === 1, `${storageWrites}/${draftWriters}`)
check('the draft is refreshed from a dependency-tracked effect', guardedWrites === 1, `${guardedWrites}`)
// The draft carries the boot id it was written under; without that stamp a
// prompt typed before a restart would come back afterwards.
check('the draft is stamped with the boot id', /writeDraft\(\{ boot: bootRef\.current, prompt, params \}\)/.test(source))
check('a draft from another run is discarded on adoption', /draft\.boot === bootRef\.current/.test(source) && /setPrompt\(''\)/.test(source))

console.log('\n[copy leaks]')
const englishLeaks = [...zhBlock.matchAll(/'([A-Za-z0-9_.]+)':\s*'([^']*)'/g)]
  .filter((match) => /[A-Za-z]{4,}/.test(match[2]) && !/[一-龥]/.test(match[2]))
  .filter((match) => !/^(Kolors|Key|API|AI|35mm|dsh-kolors-image|sk-|~\/\.dsh|http|[A-Za-z]:\\)/.test(match[2]))
  .map((match) => `${match[1]}=${match[2]}`)
check('zh copy has no untranslated sentences', englishLeaks.length === 0, englishLeaks.join(' | '))

console.log('\n[copied paths]')
// "复制文件路径" must read the same absolute path from both row shapes: the
// history rows call it `path`, the generate stage calls it `file`. Reading only
// one of them is exactly why the button copied an empty string on the stage.
check('the path helper accepts both field names', /typeof item\.path === 'string' && item\.path !== '' \? item\.path : item\.file/.test(source))
check('the lightbox no longer reads only item.path', !/copyText\(String\(item\.path \?\? ''\)\)/.test(source))
check('an empty path is refused rather than copied', /if \(realPath === ''\) \{/.test(source) && /'zoom\.pathMissing'/.test(source))
check('a failed clipboard write is reported', /setCopyState\(ok \?/.test(source) && /'zoom\.pathFailed'/.test(source))
// The stage copy is real but short-lived; saying so beats implying it is filed.
check('a temporary path says it is temporary', /'zoom\.pathCopiedTemp'/.test(source) && /transient \? 'doneTemp' : 'done'/.test(source))
check('the fallback copy selects the whole string', /setSelectionRange\(0, text\.length\)/.test(source))
// A webview that blocks the clipboard must still leave the path retrievable.
check('a blocked clipboard shows the path to copy by hand', /className: 'dshk-zoompath'/.test(source) && /node\.select\(\)/.test(source))
// Both lightboxes offer the action: the stage one and the history one.
const zoomPathButtons = [...source.matchAll(/'zoom\.copyPath'/g)].length
check('both lightboxes offer the copy action', zoomPathButtons >= 2, `${zoomPathButtons}`)

console.log('\n[background job]')
// The generation job must not belong to the tab body. Switching tabs unmounts
// that body; if the request and its result live in its useState, the picture is
// written to disk, the allowance is spent, and the page never learns about
// either — the exact "generating stops when I click elsewhere" report.
check('the job lives outside the component tree', /const STAGE = \{/.test(source))
check('progress is published through one setter', /function stageSet\(patch, silent = false\) \{[\s\S]*?Object\.assign\(STAGE, patch\)/.test(source))
check('the tab body subscribes to it', /function useStage\(\)/.test(source) && /const stage = useStage\(\)/.test(source))
check('the request is not awaited by the tab body', /async function runGenerate\(request\)/.test(source) && /const generate = \(\) => \{[\s\S]*?runGenerate\(/.test(source))
// A body must be able to disappear mid-flight without breaking the job: the
// completion callbacks are optional and guarded.
check('the page callbacks are optional', /hooks: \{ onQuota: undefined, onDone: undefined \}/.test(source) && /STAGE\.hooks\.onQuota !== undefined\) STAGE\.hooks\.onQuota/.test(source))
check('the result is not per-tab useState any more', !/const \[result, setResult\] = React\.useState/.test(source))
check('the tab body only reads the frame', /const result = stage\.result/.test(source))
// A rejected generate must not be lost either: it is reported on whichever body
// is mounted next, not on the one that happened to start it.
check('the failure survives the unmount too', /error: failure\.message, errorStatus/.test(source) && /const error = stage\.error/.test(source))
// The seed box is part of the job draft for the same reason.
check('the seed draft lives outside the tab too', /seed: ''/.test(source) && /const seedText = stage\.seed/.test(source))
// Finishing while the user is on another tab must be visible, or the picture
// arrives silently.
check('a frame that lands unseen is flagged', /unseen: STAGE\.viewing !== true/.test(source))
check('mounting the tab clears the flag', /stageSet\(\{ viewing: true, unseen: false \}\)/.test(source))
check('the tab strip says a job is running', /stage\.busy\s*\?\s*h\('span', \{ className: 'dshk-ring mini'/.test(source))
check('the tab strip says a frame is waiting', /stage\.unseen\b/.test(source) && /className: 'dshk-dot'/.test(source))
// A frame restored from the Host belongs to one boot; a new process means the
// file was retired into the trash, so the stale pointer is replaced, not kept.
check('a held frame is retired on a new boot id', /STAGE\.boot !== boot/.test(source))

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exitCode = fail === 0 ? 0 : 1
