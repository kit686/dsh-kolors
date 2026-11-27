/**
 * Host half of dsh-kolors.
 *
 * One job: put a picture on disk for the free `Kwai-Kolors/Kolors` model on
 * SiliconFlow, without ever letting the free quota be wasted on a model
 * request that the upstream would reject anyway. Concretely:
 *
 * - the model id is hard-locked; there is no model parameter anywhere;
 * - a local key pool (1..n keys) is rotated so each account keeps its own
 *   2-per-minute / 400-per-day allowance;
 * - usage bookkeeping lives in `~/.dsh/dsh-kolors.json`, keys live in
 *   `~/.dsh/secrets/kolors.env` (mode 600), the same shape the media-tools
 *   skill uses;
 * - a generated picture is cached first, and only the panel's Save button (or
 *   the model tool) copies it into `<输出目录>/dsh-kolors-image/`, which is the
 *   folder the history page reads back for the last seven days.
 *
 * The `/kolors` route prefix carries the panel's RPC and the two image streams.
 *
 * @module dsh-kolors
 */

import { chmodSync, copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path'

/** Cordis plugin name; also the client bundle id. */
export const name = 'dsh-kolors'

/** The one model this bundle is allowed to call. */
export const MODEL = 'Kwai-Kolors/Kolors'

/** SiliconFlow image generation endpoint. */
const API_URL = 'https://api.siliconflow.cn/v1/images/generations'

/** Route prefix owned by this bundle; never overlaps the kernel's `/api`. */
const ROUTE_PREFIX = '/kolors'

/** Free-tier allowance, per account (so per key in the pool). */
const MINUTE_LIMIT = 2
const DAY_LIMIT = 400

/** The history page shows this many days back by default. */
const HISTORY_DAYS = 7

/** How many rows one page of history or trash sends to the browser. */
const HISTORY_PAGE_SIZE = 400

/** Windows before the history page offers. */
const HISTORY_WINDOWS = [1, 3, 7, 30, 0]

/** Folder created inside the user's chosen output directory. */
const SAVED_FOLDER = 'dsh-kolors-image'

/** Deleted pictures — and the unsaved frame — live here. */
const TRASH_FOLDER = 'dsh-kolors-trash'

/** The only canvases Kolors documents; anything else is rejected upstream. */
export const SIZES = [
  { id: '1024x1024', ratio: '1:1', label: '方图' },
  { id: '960x1280', ratio: '3:4', label: '竖图' },
  { id: '768x1024', ratio: '3:4', label: '竖图 · 小' },
  { id: '720x1440', ratio: '1:2', label: '长图' },
  { id: '720x1280', ratio: '9:16', label: '手机壁纸' },
]

const DEFAULT_PARAMS = {
  size: '1024x1024',
  steps: 20,
  guidance: 7.5,
  negative: '',
  watermark: false,
}

/**
 * Upstream refuses anything above 50 with `code 20015: num_inference_steps:
 * Must be less than or equal to 50`, so the ceiling is enforced here rather
 * than discovered after a wasted round trip. Measured against the live API:
 * 50 answers 200, 51 is rejected.
 */
export const MAX_STEPS = 50

/**
 * How much text one request may carry.
 *
 * Kolors itself takes a short caption, not an essay; these are ceilings that
 * refuse an obviously abusive request before it costs a generation, and they sit
 * far above any prompt a person types on purpose.
 */
const MAX_PROMPT_CHARS = 4000
const MAX_NEGATIVE_CHARS = 2000

/**
 * Two separate deadlines: rendering and fetching the finished picture. They used
 * to share one 180-second AbortSignal, so a generation that took 170 seconds left
 * the download ten.
 */
const GENERATE_TIMEOUT_MS = 180_000
const DOWNLOAD_TIMEOUT_MS = 60_000

/** Error carrying the HTTP status the panel should read. */
class PanelError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/**
 * What happened when the model tool was registered. A registry rejection is
 * swallowed by the fiber's effect handling, so the panel reports it instead:
 * a `failed` row is visible in `/kolors/state` rather than only in a log.
 */
const toolStatus = { state: 'pending', message: '' }

/* ------------------------------------------------------------------ paths */

function homeDir() {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

function secretsFile() {
  return join(homeDir(), 'secrets', 'kolors.env')
}

function settingsFile() {
  return join(homeDir(), 'dsh-kolors.json')
}

/**
 * Identifies the running Host process — not this module instance.
 *
 * The panel treats the unsaved frame and the prompt draft as session state: a
 * tab switch and a page reload keep them, a full restart clears them. The only
 * honest signal for "the app was closed" is the process itself, so the id is
 * parked on `globalThis` under a symbol: a plugin reload re-imports this file
 * and gets the same value back, while a real restart starts a fresh global.
 */
const BOOT_SYMBOL = Symbol.for('dsh-kolors.boot')
const BOOT_ID = globalThis[BOOT_SYMBOL] ?? (() => {
  const created = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  Object.defineProperty(globalThis, BOOT_SYMBOL, { value: created, enumerable: false, configurable: true })
  return created
})()

/**
 * The unsaved frame's scratch folder. It is deliberately not a place the user is
 * ever pointed at: no button opens it, no path is shown. A frame lives here only
 * while it is on screen; Save copies it into the save folder, Delete moves it
 * into the trash folder, and the next start retires whatever is left.
 */
function frameDir() {
  return join(homeDir(), 'kolors-frames')
}

/** The settings file exactly as written, with no boot filtering applied. */
function rawSettings() {
  try {
    const parsed = JSON.parse(readFileSync(settingsFile(), 'utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Retire whatever the previous run left in the scratch folder. A frame that was
 * on screen when the app closed is not silently destroyed: it moves into the
 * trash carrying its prompt, so the panel opens empty and the picture is still
 * recoverable from the History page.
 */
function retireFrames() {
  let leftovers = []
  try {
    leftovers = readdirSync(frameDir()).filter((name) => name.endsWith('.png'))
  } catch {
    leftovers = []
  }
  // The raw pointer still names the frame that was on screen, even though
  // readSettings() already refused to hand it back to the panel.
  const raw = rawSettings()
  const stale = raw.lastPreview !== null && typeof raw.lastPreview === 'object' ? raw.lastPreview : null
  // A live pointer — one this very process wrote — must survive a plugin reload:
  // re-activating the bundle is not a restart, and the picture on screen is not
  // stale just because the code was re-registered.
  const live = readSettings().lastPreview
  const liveFile = live !== null && typeof live.file === 'string' ? resolve(live.file) : ''
  try {
    mkdirSync(frameDir(), { recursive: true })
    const settings = { ...raw, lastPreview: null }
    // An older build kept the unsaved frame in a per-day `kolors-cache` folder.
    // Those files are still the user's pictures, so they move into the trash
    // instead of being abandoned in a folder the panel no longer mentions.
    const legacy = join(homeDir(), 'kolors-cache')
    const legacyExists = existsSync(legacy)
    const legacyFiles = []
    if (legacyExists) {
      try {
        for (const day of readdirSync(legacy)) {
          const dir = join(legacy, day)
          try {
            for (const name of readdirSync(dir)) {
              if (name.endsWith('.png')) legacyFiles.push(join(dir, name))
            }
          } catch { /* a stray file, not a day folder */ }
        }
      } catch { /* unreadable; the folder is still removed below */ }
    }
    for (const file of [...legacyFiles, ...leftovers.map((name) => join(frameDir(), name))]) {
      if (liveFile !== '' && resolve(file) === liveFile) continue
      const known = stale !== null && typeof stale.file === 'string' && resolve(stale.file) === resolve(file)
      try {
        moveToTrash(settings, file, known ? { ...stale, origin: 'preview' } : { origin: 'preview', at: Date.now() })
      } catch {
        try { rmSync(file, { force: true }) } catch { /* best effort */ }
      }
    }
    // The folder itself is retired even when it was already empty: it belongs to
    // a layout this build no longer has, and leaving it behind only invites the
    // user to wonder what it is for.
    if (legacyExists) {
      try { rmSync(legacy, { recursive: true, force: true }) } catch { /* emptied enough */ }
    }
  } catch { /* the folder is recreated on the next write */ }
  // A pointer written by a previous process is dead weight in the settings file.
  if (raw.lastPreview !== undefined && live === null) {
    writeSettings({ ...readSettings(), lastPreview: null })
  }
}

function envName(id) {
  return `KOLORS_KEY_${id}`
}

/** `KEY=value` lines out of one secrets file; a missing file reads as empty. */
function readSecrets() {
  try {
    const out = {}
    for (const line of readFileSync(secretsFile(), 'utf8').split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (match !== null) out[match[1]] = match[2].trim()
    }
    return out
  } catch {
    return {}
  }
}

/** Rewrite the whole secrets file at mode 600; only this bundle's keys live in it. */
function writeSecrets(pairs) {
  const file = secretsFile()
  mkdirSync(dirname(file), { recursive: true })
  const lines = Object.entries(pairs)
    .filter(([, value]) => typeof value === 'string' && value !== '')
    .map(([key, value]) => `${key}=${value}`)
  writeFileSync(file, `${lines.join('\n')}\n`, { mode: 0o600 })
  try { chmodSync(file, 0o600) } catch { /* best effort on odd filesystems */ }
}

/** Mask a key for display: keep the last four characters only. */
function maskKey(value) {
  if (typeof value !== 'string' || value === '') return ''
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`
}

/* --------------------------------------------------------------- settings */

/**
 * Where pictures go when the user has not chosen a folder.
 *
 * `~/Pictures` is a Windows and macOS convention; on a bare Linux box it does
 * not exist and creating it is presumptuous. The XDG pictures directory is only
 * used when it really is there, and everything else falls back to the home
 * directory itself, which every platform has.
 */
function outputDirOf(settings) {
  const raw = typeof settings.outputDir === 'string' ? settings.outputDir.trim() : ''
  if (raw !== '') return raw
  const pictures = join(homedir(), 'Pictures')
  if (existsSync(pictures)) return pictures
  const xdg = process.env.XDG_PICTURES_DIR
  if (typeof xdg === 'string' && xdg !== '' && existsSync(xdg)) return xdg
  return homedir()
}

function savedRoot(settings) {
  return join(outputDirOf(settings), SAVED_FOLDER)
}

/**
 * Deleted pictures. This lives inside the save folder on purpose: it is the
 * same volume as the originals (a move is instant and cannot half-fail), it
 * belongs to the user rather than to the plugin's private cache, and a user who
 * deletes the folder deletes the trash with it. The index row is rewritten, so
 * nothing in the panel ever reads a picture out of here by accident.
 */
function trashRoot(settings) {
  return join(savedRoot(settings), TRASH_FOLDER)
}

function readSettings() {
  let parsed = {}
  try {
    const value = JSON.parse(readFileSync(settingsFile(), 'utf8'))
    if (value !== null && typeof value === 'object') parsed = value
  } catch {
    parsed = {}
  }
  const requestedDays = Number(parsed.historyDays)
  const stored = typeof parsed.params === 'object' && parsed.params !== null ? parsed.params : {}
  const settings = {
    outputDir: outputDirOf(parsed),
    // Re-clamp on read, not only on write: a config saved by an older build can
    // hold a step count the upstream now refuses, and merging it verbatim would
    // carry that refusal into every later run.
    params: {
      ...DEFAULT_PARAMS,
      ...stored,
      size: sizeOf(String(stored.size ?? DEFAULT_PARAMS.size)).id,
      steps: Math.round(clamp(stored.steps, 1, MAX_STEPS, DEFAULT_PARAMS.steps)),
      guidance: clamp(stored.guidance, 0.1, 20, DEFAULT_PARAMS.guidance),
    },
    keys: Array.isArray(parsed.keys) ? parsed.keys.filter((key) => key !== null && typeof key === 'object') : [],
    usage: typeof parsed.usage === 'object' && parsed.usage !== null ? parsed.usage : {},
    // 0 means "everything", which is a real choice and not a missing value.
    historyDays: HISTORY_WINDOWS.includes(requestedDays) ? requestedDays : HISTORY_DAYS,
    // The unsaved frame the panel is showing. It is bound to this Host process:
    // switching tabs or pages keeps it, a full restart drops it, which is what
    // "closing the app clears the preview" means without a second timer.
    lastPreview: typeof parsed.lastPreview === 'object'
      && parsed.lastPreview !== null
      && parsed.lastPreview.boot === BOOT_ID
      ? parsed.lastPreview
      : null,
  }
  // A preview row whose file is gone cannot be restored; drop it quietly.
  if (settings.lastPreview !== null && typeof settings.lastPreview.file === 'string') {
    if (!existsSync(settings.lastPreview.file)) settings.lastPreview = null
  } else if (settings.lastPreview !== null) {
    settings.lastPreview = null
  }
  // A pool entry without an id cannot address its secret; drop it rather than
  // carrying a half-record into the rotation.
  settings.keys = settings.keys.filter((key) => typeof key.id === 'string' && key.id !== '')
  return settings
}

function writeSettings(settings) {
  const file = settingsFile()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
  try { chmodSync(file, 0o600) } catch { /* best effort */ }
}

function dayKey(at) {
  const date = new Date(at)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Usage stamps for one key, trimmed to what the two windows can still see:
 * today's local-date stamps plus anything inside the last minute.
 */
function usageOf(settings, id, now) {
  const raw = Array.isArray(settings.usage[id]) ? settings.usage[id] : []
  const today = dayKey(now)
  return raw
    .filter((at) => typeof at === 'number' && Number.isFinite(at))
    .filter((at) => at > now - 60_000 || dayKey(at) === today)
    .slice(-DAY_LIMIT - 20)
}

/** Per-key counters plus the pool total the panel shows at the top. */
function quotaOf(settings, secrets, now = Date.now()) {
  const today = dayKey(now)
  const rows = []
  for (const key of settings.keys) {
    const stamps = usageOf(settings, key.id, now)
    const minuteUsed = stamps.filter((at) => now - at < 60_000).length
    const dayUsed = stamps.filter((at) => dayKey(at) === today).length
    const configured = (secrets[envName(key.id)] ?? '') !== ''
    const enabled = key.enabled !== false && configured
    rows.push({
      id: key.id,
      label: key.label ?? `Key ${key.id}`,
      hint: maskKey(secrets[envName(key.id)] ?? ''),
      configured,
      enabled: key.enabled !== false,
      minuteUsed,
      minuteLimit: MINUTE_LIMIT,
      dayUsed,
      dayLimit: DAY_LIMIT,
      available: enabled && minuteUsed < MINUTE_LIMIT && dayUsed < DAY_LIMIT,
    })
  }
  const live = rows.filter((row) => row.enabled && row.configured)
  return {
    minuteLeft: live.reduce((sum, row) => sum + Math.max(0, MINUTE_LIMIT - row.minuteUsed), 0),
    minuteLimit: MINUTE_LIMIT * Math.max(1, live.length),
    dayLeft: live.reduce((sum, row) => sum + Math.max(0, DAY_LIMIT - row.dayUsed), 0),
    dayLimit: DAY_LIMIT * Math.max(1, live.length),
    keys: rows,
  }
}

/* ----------------------------------------------------------------- rotate */

/**
 * Pick the key to spend this request on: enabled, configured, and inside both
 * windows for its own account. Most minute room wins, then most day room, so
 * one exhausted account never blocks a fresh one.
 */
function pickKey(settings, secrets, now) {
  const today = dayKey(now)
  const usable = []
  for (const key of settings.keys) {
    if (key.enabled === false) continue
    const value = secrets[envName(key.id)] ?? ''
    if (value === '') continue
    const stamps = usageOf(settings, key.id, now)
    const minuteUsed = stamps.filter((at) => now - at < 60_000).length
    const dayUsed = stamps.filter((at) => dayKey(at) === today).length
    if (minuteUsed >= MINUTE_LIMIT || dayUsed >= DAY_LIMIT) continue
    usable.push({ key, value, minuteUsed, dayUsed })
  }
  if (usable.length === 0) return undefined
  usable.sort((a, b) => (a.minuteUsed - b.minuteUsed) || (a.dayUsed - b.dayUsed) || a.key.id.localeCompare(b.key.id))
  return usable[0]
}

/** Record one spend before the request so a slow call cannot overshoot the window. */
function markUse(settings, id, now) {
  const stamps = usageOf(settings, id, now)
  stamps.push(now)
  settings.usage[id] = stamps
}

/** Give the stamp back when the call failed for a reason that spent nothing. */
function refundUse(settings, id, now) {
  const stamps = usageOf(settings, id, now)
  const at = stamps.lastIndexOf(now)
  if (at !== -1) stamps.splice(at, 1)
  settings.usage[id] = stamps
}

/* -------------------------------------------------------------- the model */

/** Parse `WxH` out of our own size table; unknown canvases fall back to 1024². */
function sizeOf(id) {
  return SIZES.find((size) => size.id === id) ?? SIZES[0]
}

function clamp(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

/**
 * Normalize panel or tool input into one request. Every value is bounded here
 * rather than trusted from the caller, because the panel and the model tool
 * are two independent entry points into the same upstream account.
 */
function requestOf(input) {
  const prompt = String(input?.prompt ?? '').trim()
  if (prompt === '') throw new PanelError(400, '提示词不能为空。')
  // The panel and the model tool are two independent callers; neither is
  // trusted to bound its own input. The upstream truncates far below this, and a
  // runaway prompt is the cheapest way to spend a request on a worthless image.
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new PanelError(400, `提示词太长了（${prompt.length} 字），上限 ${MAX_PROMPT_CHARS} 字。`)
  }
  const size = sizeOf(String(input?.size ?? ''));
  const negative = String(input?.negative_prompt ?? '').trim().slice(0, MAX_NEGATIVE_CHARS)
  const steps = Math.round(clamp(input?.steps, 1, MAX_STEPS, DEFAULT_PARAMS.steps))
  const guidance = clamp(input?.guidance, 0.1, 20, DEFAULT_PARAMS.guidance)
  const seedInput = input?.seed
  const seed = seedInput === undefined || seedInput === null || String(seedInput).trim() === ''
    ? undefined
    : Math.round(clamp(seedInput, 0, 9_999_999_999, undefined))
  return {
    prompt,
    size,
    negative,
    steps,
    guidance,
    seed,
    watermark: input?.watermark === true,
  }
}

/** One readable sentence per upstream failure, phrased for someone holding a free key. */
function explainStatus(status, body) {
  const detail = typeof body?.message === 'string' ? body.message.trim() : ''
  const tail = detail === '' ? '' : `（${detail.slice(0, 120)}）`
  switch (status) {
    case 400: return `请求被拒（400）${tail}`
    case 401: return `Key 无效或已过期（401），回「Key」页重新粘贴${tail}`
    case 402: return '账户余额不足（402）。Kolors 免费，但平台要求余额不小于 0，去硅基流动充 1 元作保证金。'
    case 403: return `没有权限（403），检查这个 Key 所属账号是否可用${tail}`
    case 404: return `接口地址或参数不对（404）${tail}`
    case 429: return '平台级限流（429），这个账号这一分钟已经出过 2 张，等一分钟再来。'
    case 503: return '硅基流动暂时不可用（503），稍后再试。'
    case 504: return '平台超时（504），稍后再试。'
    default: return `生成失败（${status}）${tail}`
  }
}

/** Download the freshly minted picture; its URL expires after one hour. */
async function downloadImage(url, signal) {
  const response = await fetch(url, { signal, redirect: 'follow' })
  if (!response.ok) throw new PanelError(502, `图片下载失败（${response.status}）`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) throw new PanelError(502, '图片下载回来是空的，重试一次。')
  return bytes
}

/**
 * Run one generation end to end and leave the bytes in the cache folder.
 * Rotates keys, keeps the local windows honest, and never retries on a quota
 * refusal — retrying would only burn the next account in the pool.
 */
async function generate(input, options = {}) {
  const now = Date.now()
  const settings = readSettings()
  const secrets = readSecrets()
  const request = requestOf(input)

  if (settings.keys.length === 0) {
    throw new PanelError(400, '还没有 API Key。先去「Key」页粘贴一个硅基流动的 Key。')
  }
  const picked = pickKey(settings, secrets, now)
  if (picked === undefined) {
    const live = settings.keys.filter((key) => key.enabled !== false && (secrets[envName(key.id)] ?? '') !== '')
    throw new PanelError(429, live.length === 0
      ? 'Key 池里没有可用的 Key。去「Key」页粘贴一个，或者启用已有的那个。'
      : `整池额度都用完了：每 Key 每分钟 ${MINUTE_LIMIT} 张、每天 ${DAY_LIMIT} 张。等一分钟，或再加一个 Key。`)
  }

  markUse(settings, picked.key.id, now)
  writeSettings(settings)

  const body = {
    model: MODEL,
    prompt: request.prompt,
    image_size: request.size.id,
    num_inference_steps: request.steps,
    guidance_scale: request.guidance,
  }
  if (request.negative !== '') body.negative_prompt = request.negative
  if (request.seed !== undefined) body.seed = request.seed

  // The generation gets its own deadline. The download below gets a fresh one:
  // sharing a single 180-second budget meant a slow generation left the download
  // a few seconds to finish an already-paid-for picture, which then "failed".
  const signal = options.signal ?? AbortSignal.timeout(GENERATE_TIMEOUT_MS)
  let payload
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${picked.value}`,
        'x-enable-watermark': request.watermark ? '1' : '0',
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      let parsed = {}
      try { parsed = await response.json() } catch { parsed = {} }
      // Only 429 proves the upstream meter moved against this account. A 401,
      // 402, or 5xx spent no generation, so the local stamp goes back: a bad
      // key or an empty wallet must not eat the day's allowance.
      if (response.status !== 429) {
        const later = readSettings()
        refundUse(later, picked.key.id, now)
        writeSettings(later)
      }
      throw new PanelError(response.status === 429 ? 429 : 502, explainStatus(response.status, parsed))
    }
    payload = await response.json()
  } catch (error) {
    if (error instanceof PanelError) throw error
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    // A timeout does not prove the upstream spent nothing: it may well have
    // rendered the picture and only been slow to answer. Returning the stamp
    // would let the user retry, spend a real upstream slot, and then hit a 429
    // the local meter said was impossible. Only refusals that provably cost
    // nothing are refunded; a timeout keeps its stamp.
    if (!timedOut) {
      const later = readSettings()
      refundUse(later, picked.key.id, now)
      writeSettings(later)
    }
    const reason = timedOut
      ? `请求超时（${GENERATE_TIMEOUT_MS / 1000} 秒），上游没有返回。额度先按已用计，等一分钟再试。`
      : `连不上硅基流动：${error?.message ?? error}`
    throw new PanelError(504, reason)
  }

  const imageUrl = payload?.images?.[0]?.url
  if (typeof imageUrl !== 'string' || imageUrl === '') {
    const later = readSettings()
    refundUse(later, picked.key.id, now)
    writeSettings(later)
    throw new PanelError(502, '上游没有返回图片地址，重试一次。')
  }
  let bytes
  try {
    // Its own deadline, and it never inherits the caller's abort: the picture is
    // already generated and paid for, so cancelling now would waste it.
    bytes = await downloadImage(imageUrl, AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS))
  } catch (error) {
    throw new PanelError(502, error instanceof PanelError ? error.message : '图片下载失败，重试一次。')
  }

  const dir = frameDir()
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `kolors-${now}-${Math.random().toString(36).slice(2, 8)}.png`)
  writeFileSync(file, bytes)

  const record = {
    id: `${now}`,
    file,
    src: cacheUrl(file),
    prompt: request.prompt,
    negative: request.negative,
    size: request.size.id,
    steps: request.steps,
    guidance: request.guidance,
    seed: typeof payload?.seed === 'number' ? payload.seed : request.seed ?? null,
    // The preview keeps the flag: saving it later must record what was drawn.
    watermark: request.watermark,
    at: now,
    boot: BOOT_ID,
    keyId: picked.key.id,
    keyLabel: picked.key.label ?? `Key ${picked.key.id}`,
    keyHint: maskKey(picked.value),
  }
  // The frame survives a tab switch, a page reload, and a panel remount, because
  // the pointer lives on disk. It does not survive a restart: the pointer carries
  // BOOT_ID, and a new process reads its own id instead.
  const later = readSettings()
  later.lastPreview = record
  writeSettings(later)
  return { record, quota: quotaOf(readSettings(), readSecrets(), Date.now()) }
}

/* ---------------------------------------------------------------- storage */

function cacheUrl(file) {
  return `${ROUTE_PREFIX}/frame?p=${encodeURIComponent(file)}`
}

function savedUrl(file) {
  return `${ROUTE_PREFIX}/saved?p=${encodeURIComponent(file)}`
}

function trashUrl(file) {
  return `${ROUTE_PREFIX}/trash-file?p=${encodeURIComponent(file)}`
}

/** The saved-picture index beside the pictures themselves. */
function indexPath(settings) {
  return join(savedRoot(settings), 'index.json')
}

function trashIndexPath(settings) {
  return join(trashRoot(settings), 'index.json')
}

function readIndex(settings) {
  return readRows(indexPath(settings))
}

function writeIndex(settings, rows) {
  writeRows(indexPath(settings), rows)
}

function readTrash(settings) {
  return readRows(trashIndexPath(settings))
}

function writeTrash(settings, rows) {
  mkdirSync(trashRoot(settings), { recursive: true })
  writeRows(trashIndexPath(settings), rows)
}

function readRows(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    return Array.isArray(parsed) ? parsed.filter((row) => row !== null && typeof row === 'object') : []
  } catch {
    return []
  }
}

function writeRows(file, rows) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`)
}

/** Refuse a path that is not inside `root`, after resolving `..` away. */
function insidePath(root, candidate) {
  const base = resolve(root)
  const target = resolve(candidate)
  return target === base || target.startsWith(base + sep)
}

/**
 * Copy the on-screen frame into the save folder and file it in the index.
 *
 * With `options.stage === true` (the panel's Save button) the filed row stays
 * the stage pointer, flagged `filed`. That keeps the stage honest after a save:
 * leaving the page and coming back shows the same picture with 已保存 greyed out
 * and no Delete button. A tool call passes `stage: false` — it never had a
 * browser stage, and the picture belongs to the history page only.
 */
function savePicture(input, options = {}) {
  const settings = readSettings()
  const raw = String(input?.file ?? '')
  if (raw === '') throw new PanelError(400, '缺少要保存的文件。')
  if (!insidePath(frameDir(), raw)) throw new PanelError(403, '只能保存本插件生成的图。')
  if (!existsSync(raw)) throw new PanelError(404, '这张图已经不在预览里了，重新生成一张。')

  const root = savedRoot(settings)
  mkdirSync(root, { recursive: true })
  const record = writeSaved(settings, raw, input)
  // The scratch copy has served its purpose; the filed copy is the real one.
  rmSync(raw, { force: true })
  const later = readSettings()
  later.lastPreview = options.stage === false
    ? null
    : { ...record, file: record.path, src: record.src, filed: true, boot: BOOT_ID }
  writeSettings(later)
  return { ok: true, saved: record, folder: root }
}

/** Place one file into the save folder under a timestamped name, and index it. */
function writeSaved(settings, source, input) {
  const root = savedRoot(settings)
  mkdirSync(root, { recursive: true })
  const stamp = new Date(Number(input?.at ?? Date.now()) || Date.now())
  const pad = (n) => String(n).padStart(2, '0')
  const name = `kolors-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}`
    + `-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}`
    + `-${Math.random().toString(36).slice(2, 6)}.png`
  const target = join(root, name)
  copyFileSync(source, target)

  const rows = readIndex(settings)
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    path: target,
    src: savedUrl(target),
    prompt: String(input?.prompt ?? ''),
    negative: String(input?.negative ?? ''),
    size: String(input?.size ?? ''),
    steps: Number(input?.steps ?? DEFAULT_PARAMS.steps),
    guidance: Number(input?.guidance ?? DEFAULT_PARAMS.guidance),
    seed: input?.seed === null || input?.seed === undefined ? null : Number(input.seed),
    watermark: input?.watermark === true,
    keyLabel: String(input?.keyLabel ?? ''),
    at: Number(input?.at ?? Date.now()),
  }
  rows.push(record)
  // The index is the history; the pictures are the user's files. Keep every row
  // whose file still exists so a picture outside the current window stays
  // reachable on disk, and cap the list generously.
  const kept = rows
    .filter((row) => typeof row.at === 'number' && typeof row.path === 'string' && existsSync(row.path))
    .sort((a, b) => a.at - b.at)
    .slice(-4000)
  writeIndex(settings, kept)
  return record
}

/**
 * Throw the on-screen frame away. Nothing is unlinked: the bytes move into the
 * trash folder, which is the only place an unsaved picture goes — there is no
 * separate preview folder to lose it in.
 */
function discardCached(input) {
  const settings = readSettings()
  const raw = String(input?.file ?? '')
  if (raw === '' || !insidePath(frameDir(), raw)) throw new PanelError(403, '只能删除本插件生成的图。')
  if (!existsSync(raw)) return { ok: true, trashed: null }
  const trashed = moveToTrash(settings, raw, input)
  return { ok: true, trashed }
}

/** Park a file in the trash folder, keeping its metadata in the trash index. */
function moveToTrash(settings, source, input) {
  // The preview being deleted is no longer the one to restore.
  if (settings.lastPreview !== null && resolve(settings.lastPreview.file ?? '') === resolve(source)) {
    settings.lastPreview = null
  }
  const root = trashRoot(settings)
  mkdirSync(root, { recursive: true })
  const stamp = new Date(Number(input?.at ?? Date.now()) || Date.now())
  const pad = (n) => String(n).padStart(2, '0')
  const name = `kolors-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}`
    + `-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}`
    + `-${Math.random().toString(36).slice(2, 6)}.png`
  const target = join(root, name)
  copyFileSync(source, target)
  rmSync(source, { force: true })

  const rows = readTrash(settings)
  const record = {
    id: `trash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    path: target,
    src: trashUrl(target),
    prompt: String(input?.prompt ?? ''),
    negative: String(input?.negative ?? ''),
    size: String(input?.size ?? ''),
    steps: Number(input?.steps ?? DEFAULT_PARAMS.steps),
    guidance: Number(input?.guidance ?? DEFAULT_PARAMS.guidance),
    seed: input?.seed === null || input?.seed === undefined ? null : Number(input.seed),
    watermark: input?.watermark === true,
    keyLabel: String(input?.keyLabel ?? ''),
    at: Number(input?.at ?? Date.now()),
    deletedAt: Date.now(),
    origin: String(input?.origin ?? 'preview'),
  }
  rows.push(record)
  writeTrash(settings, pruneTrash(settings, rows))
  // The caller re-reads settings, so persist the cleared preview pointer here.
  writeSettings(settings)
  return record
}

/**
 * The trash ceiling. Once it is reached the oldest entry is evicted, and
 * eviction deletes the file as well as the row.
 *
 * Dropping only the index row used to leave the PNG on disk with nothing that
 * named it: invisible in the panel, unreachable from the UI, and impossible to
 * remove without opening the folder by hand. Every delete past the ceiling
 * leaked one more file.
 */
const TRASH_LIMIT = 2000

function pruneTrash(settings, rows) {
  const alive = []
  for (const row of rows) {
    // A row whose file is gone cannot be restored or previewed.
    if (typeof row.path !== 'string' || !existsSync(row.path)) continue
    alive.push(row)
  }
  alive.sort((a, b) => Number(a.deletedAt ?? a.at ?? 0) - Number(b.deletedAt ?? b.at ?? 0))
  const evicted = alive.length > TRASH_LIMIT ? alive.splice(0, alive.length - TRASH_LIMIT) : []
  for (const row of evicted) {
    try { rmSync(row.path, { force: true }) } catch { /* the row still goes */ }
  }
  return alive
}

/** The saved pictures inside one time window; 0 days means everything. */
function history(days) {
  const settings = readSettings()
  const wanted = HISTORY_WINDOWS.includes(Number(days)) ? Number(days) : settings.historyDays
  const since = wanted === 0 ? 0 : Date.now() - wanted * 86_400_000
  // Filter by the window first — it is pure arithmetic — then stat only the
  // rows that can still reach the page. Checking every row in the index meant
  // thousands of synchronous statSync calls per history read, on the event loop.
  const inWindow = readIndex(settings)
    .filter((row) => typeof row.at === 'number' && row.at >= since)
    .sort((a, b) => b.at - a.at)
  const alive = []
  for (const row of inWindow) {
    if (alive.length === HISTORY_PAGE_SIZE) break
    if (typeof row.path !== 'string' || !existsSync(row.path)) continue
    alive.push(row)
  }
  // The page shows a bounded window; say so instead of silently dropping rows.
  const items = alive.map((row) => ({ ...row, src: savedUrl(row.path) }))
  return {
    ok: true,
    days: wanted,
    windows: HISTORY_WINDOWS,
    folder: savedRoot(settings),
    items,
    total: inWindow.length,
    truncated: inWindow.length > items.length,
  }
}

/** Move one saved picture to the trash and drop its index row. */
function deleteSaved(input) {
  const settings = readSettings()
  const ids = Array.isArray(input?.ids) ? input.ids.map(String) : [String(input?.id ?? '')].filter((id) => id !== '')
  if (ids.length === 0) throw new PanelError(400, '没有选中要删除的图。')
  const rows = readIndex(settings)
  const moved = []
  const kept = []
  for (const row of rows) {
    if (!ids.includes(String(row.id))) { kept.push(row); continue }
    if (typeof row.path === 'string' && insidePath(savedRoot(settings), row.path) && existsSync(row.path)) {
      moved.push(moveToTrash(settings, row.path, { ...row, origin: 'saved' }))
    }
  }
  writeIndex(settings, kept)
  return { ok: true, moved: moved.length }
}

/** Everything waiting in the trash, newest first. */
function trash() {
  const settings = readSettings()
  const rows = readTrash(settings)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  // Sort first, then stat only the rows that can reach the page — same reason as
  // in history(): statSync is synchronous and this runs on the event loop.
  const alive = []
  for (const row of rows) {
    if (alive.length === HISTORY_PAGE_SIZE) break
    if (typeof row.path !== 'string' || !existsSync(row.path)) continue
    alive.push(row)
  }
  const items = alive.map((row) => ({ ...row, src: trashUrl(row.path) }))
  return { ok: true, folder: trashRoot(settings), items, total: rows.length, truncated: rows.length > items.length }
}

/** Put one trashed picture back into the save folder. */
function restoreTrashed(input) {
  const settings = readSettings()
  const ids = Array.isArray(input?.ids) ? input.ids.map(String) : [String(input?.id ?? '')].filter((id) => id !== '')
  if (ids.length === 0) throw new PanelError(400, '没有选中要恢复的图。')
  const rows = readTrash(settings)
  const restored = []
  const kept = []
  for (const row of rows) {
    if (!ids.includes(String(row.id))) { kept.push(row); continue }
    if (typeof row.path !== 'string' || !existsSync(row.path)) continue
    restored.push(writeSaved(settings, row.path, row))
    rmSync(row.path, { force: true })
  }
  writeTrash(settings, kept)
  return { ok: true, restored: restored.length }
}

/** Unlink trashed pictures for good. */
function purgeTrashed(input) {
  const settings = readSettings()
  const ids = Array.isArray(input?.ids) ? input.ids.map(String) : [String(input?.id ?? '')].filter((id) => id !== '')
  const empty = input?.all === true
  if (ids.length === 0 && !empty) throw new PanelError(400, '没有选中要彻底删除的图。')
  const rows = readTrash(settings)
  const kept = []
  let purged = 0
  for (const row of rows) {
    const hit = empty || ids.includes(String(row.id))
    if (!hit) { kept.push(row); continue }
    if (typeof row.path === 'string' && insidePath(trashRoot(settings), row.path)) {
      rmSync(row.path, { force: true })
      purged += 1
    }
  }
  writeTrash(settings, kept)
  return { ok: true, purged }
}

/* ------------------------------------------------------------------ panel */

/**
 * One-shot facts the panel cannot read for itself: whether the composition
 * mounted a native folder chooser, and how it is reached. Filled at activation.
 */
let pickerAvailable = false

/** The mounted native picker, when this composition has one. */
let pickerService

/** Everything the panel needs on first paint; secrets stay masked. */
function state() {
  const settings = readSettings()
  const secrets = readSecrets()
  const quota = quotaOf(settings, secrets)
  return {
    ok: true,
    model: MODEL,
    version: readVersion(),
    outputDir: outputDirOf(settings),
    folder: savedRoot(settings),
    params: settings.params,
    sizes: SIZES,
    quota,
    keys: settings.keys.map((key) => ({
      id: key.id,
      label: key.label ?? `Key ${key.id}`,
      enabled: key.enabled !== false,
      configured: (secrets[envName(key.id)] ?? '') !== '',
      hint: maskKey(secrets[envName(key.id)] ?? ''),
    })),
    limits: { minute: MINUTE_LIMIT, day: DAY_LIMIT, historyDays: settings.historyDays, windows: HISTORY_WINDOWS },
    ready: quota.dayLeft > 0,
    tool: { name: 'kolors_image', ...toolStatus },
    trashDir: trashRoot(settings),
    canPickFolder: pickerAvailable,
    // The unsaved frame to put back on screen; null when there is none.
    preview: settings.lastPreview,
    // Lets the panel tell "same session, came back" from "the app restarted":
    // the draft is kept in the first case and cleared in the second.
    boot: BOOT_ID,
  }
}

function readVersion() {
  try {
    return JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
  } catch {
    return '0.0.0'
  }
}

/** Add, edit, enable, or remove one pool entry. */
function keyAction(input) {
  const settings = readSettings()
  const action = String(input?.action ?? '')
  const secrets = readSecrets()

  if (action === 'add') {
    const value = String(input?.value ?? '').trim()
    if (value === '') throw new PanelError(400, 'Key 不能为空。')
    if (!/^[\x21-\x7e]+$/.test(value)) throw new PanelError(400, 'Key 里出现了空格或非 ASCII 字符，检查一下复制是否完整。')
    const used = new Set(settings.keys.map((key) => key.id))
    let id = 1
    while (used.has(String(id))) id += 1
    settings.keys.push({ id: String(id), label: String(input?.label ?? '').trim() || `Key ${id}`, enabled: true, addedAt: Date.now() })
    secrets[envName(id)] = value
    writeSecrets(secrets)
    writeSettings(settings)
    return state()
  }

  const id = String(input?.id ?? '')
  const key = settings.keys.find((item) => item.id === id)
  if (key === undefined) throw new PanelError(404, '找不到这个 Key。')

  if (action === 'update') {
    const label = String(input?.label ?? '').trim()
    if (label !== '') key.label = label
    if (typeof input?.enabled === 'boolean') key.enabled = input.enabled
    const value = String(input?.value ?? '').trim()
    if (value !== '') {
      if (!/^[\x21-\x7e]+$/.test(value)) throw new PanelError(400, 'Key 里出现了空格或非 ASCII 字符，检查一下复制是否完整。')
      secrets[envName(id)] = value
      writeSecrets(secrets)
    }
    writeSettings(settings)
    return state()
  }

  if (action === 'remove') {
    settings.keys = settings.keys.filter((item) => item.id !== id)
    delete settings.usage[id]
    delete secrets[envName(id)]
    writeSecrets(secrets)
    writeSettings(settings)
    return state()
  }

  throw new PanelError(400, `不认识的操作：${action}`)
}

/** Persist the output directory and the last-used generation parameters. */
function settingsAction(input) {
  const settings = readSettings()
  if (typeof input?.outputDir === 'string' && input.outputDir.trim() !== '') {
    const dir = input.outputDir.trim()
    if (!isAbsolute(dir)) throw new PanelError(400, '请填一个绝对路径，比如 C:\\Users\\你\\Pictures。')
    mkdirSync(dir, { recursive: true })
    settings.outputDir = dir
  }
  if (typeof input?.params === 'object' && input.params !== null) {
    settings.params = {
      size: sizeOf(String(input.params.size ?? settings.params.size)).id,
      steps: Math.round(clamp(input.params.steps, 1, MAX_STEPS, settings.params.steps)),
      guidance: clamp(input.params.guidance, 0.1, 20, settings.params.guidance),
      negative: String(input.params.negative ?? settings.params.negative ?? '').slice(0, 2000),
      watermark: input.params.watermark === true,
    }
  }
  if (input?.historyDays !== undefined) {
    const days = Number(input.historyDays)
    if (!HISTORY_WINDOWS.includes(days)) throw new PanelError(400, '只支持 1、3、7、30 天或全部。')
    settings.historyDays = days
  }
  writeSettings(settings)
  return state()
}

/* ------------------------------------------------------- open in file manager */

/**
 * Reveal a folder in the desktop's own file manager.
 *
 * The right tool is a composition service, and none of the mounted ones opens a
 * folder: the panel reaches the host only over HTTP, so the plugin spawns the
 * platform's own opener. The path is never interpolated into a shell string —
 * argv is passed as an array, and only a directory this plugin owns reaches it.
 */
async function revealFolder(target) {
  const settings = readSettings()
  const allowed = [savedRoot(settings), trashRoot(settings), outputDirOf(settings)]
  const resolved = resolve(target)
  if (!allowed.some((root) => insidePath(root, resolved))) {
    throw new PanelError(403, '只能打开本插件的目录。')
  }
  mkdirSync(resolved, { recursive: true })

  const { spawn } = await import('node:child_process')
  const child = process.platform === 'win32'
    ? spawn('explorer.exe', [resolved], { detached: true, stdio: 'ignore' })
    // `open` on macOS, `xdg-open` elsewhere; both take the directory as argv[1].
    : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [resolved], { detached: true, stdio: 'ignore' })
  await new Promise((resolveReady, rejectReady) => {
    child.once('error', rejectReady)
    child.once('spawn', resolveReady)
    // explorer.exe exits immediately with a nonzero code even on success, so a
    // later exit is not an error signal and is deliberately not awaited.
  })
  child.unref()
  return { ok: true, path: resolved }
}

/* ------------------------------------------------------------------ routes */

/** Reject cross-site callers: the panel is same-origin, a random page is not. */
function originAllowed(req) {
  const host = req.headers.host
  if (typeof host !== 'string' || host === '') return false
  const origin = req.headers.origin ?? req.headers.referer
  if (origin === undefined) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * The largest RPC body this panel accepts.
 *
 * The only bulk field is a prompt or a negative prompt; 1 MiB is far beyond any
 * useful prompt (roughly 350k Chinese characters) and keeps a runaway caller
 * from turning the body reader into a memory amplifier.
 */
const MAX_BODY_BYTES = 1024 * 1024

/**
 * Read one JSON body.
 *
 * The chunks are concatenated as buffers, never decoded one at a time: a TCP
 * segment boundary lands wherever it likes, and `String(chunk)` on each piece
 * splits a multi-byte character across two decodes. Each half then becomes
 * U+FFFD, so a long Chinese prompt silently arrived at the model with mojibake
 * in it — measured at roughly 22k Chinese characters, where the body first
 * spans more than one 64 KiB read. Decoding once, after the whole body is in
 * hand, cannot split a character.
 */
async function readBody(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8')
    total += bytes.length
    // Refuse rather than buffer without bound; the caller is not a browser the
    // user is watching, so a silent OOM would be the worst outcome.
    if (total > MAX_BODY_BYTES) throw new PanelError(413, `请求体超过 ${MAX_BODY_BYTES} 字节。`)
    chunks.push(bytes)
  }
  if (total === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

/**
 * Stream one picture, but only from the folder its route owns.
 *
 * Two things matter here and neither is decoration:
 *
 * - The bytes are piped, not read into a Buffer. The history page can ask for
 *   hundreds of multi-megabyte PNGs at once, and `readFileSync` would hold every
 *   one of them in the Host's heap simultaneously.
 * - The response carries a validator. The panel re-fetches the same pictures on
 *   every tab switch, and a picture never changes once written, so `ETag` +
 *   `If-None-Match` turns those re-reads into 304s with no body at all.
 *
 * `no-store` is deliberately gone: with an ETag the browser may keep its own
 * copy, and a 304 still revalidates it, so a deleted picture stops being served
 * rather than being shown from a stale cache forever.
 */
function sendFile(req, res, root, rawPath, mediaType = 'image/png') {
  const target = rawPath === null ? '' : rawPath
  if (target === '' || !insidePath(root, target)) {
    sendJson(res, 403, { ok: false, message: 'path outside the picture folder' })
    return
  }
  let info
  try {
    info = statSync(target)
  } catch {
    sendJson(res, 404, { ok: false, message: '图片不在了' })
    return
  }
  if (!info.isFile()) {
    sendJson(res, 404, { ok: false, message: '图片不在了' })
    return
  }
  // Size and mtime identify the bytes: the plugin writes a file once, under a
  // random name, and never rewrites it.
  const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`
  if (req?.headers?.['if-none-match'] === etag) {
    res.writeHead(304, { etag, 'cache-control': 'private, max-age=0, must-revalidate' })
    res.end()
    return
  }
  res.writeHead(200, {
    'content-type': mediaType,
    'content-length': info.size,
    etag,
    'cache-control': 'private, max-age=0, must-revalidate',
  })
  if (req === undefined) {
    // A caller without a request object cannot revalidate, so it gets the bytes.
    res.end(readFileSync(target))
    return
  }
  const stream = createReadStream(target)
  stream.on('error', () => {
    // The headers are already out; the only honest signal left is to cut the
    // connection so the browser does not treat a short body as the whole file.
    res.destroy()
  })
  // A client that navigates away mid-transfer leaves a half-consumed stream;
  // close it rather than waiting for the descriptor to be collected.
  res.on('close', () => { stream.destroy() })
  stream.pipe(res)
}

/** The `/kolors` prefix handler: panel RPC plus the picture streams. */
export function createHandler() {
  return async function kolorsHandler(req, res) {
    if (!originAllowed(req)) {
      sendJson(res, 403, { ok: false, message: 'cross-site request refused' })
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = url.pathname.slice(ROUTE_PREFIX.length) || '/'
    const method = req.method ?? 'GET'

    try {
      if (route === '/state' && method === 'GET') {
        sendJson(res, 200, state())
        return
      }
      if (route === '/history' && method === 'GET') {
        sendJson(res, 200, history(url.searchParams.get('days') ?? undefined))
        return
      }
      if (route === '/trash' && method === 'GET') {
        sendJson(res, 200, trash())
        return
      }
      if (route === '/frame' && method === 'GET') {
        sendFile(req, res, frameDir(), url.searchParams.get('p'))
        return
      }
      if (route === '/saved' && method === 'GET') {
        sendFile(req, res, savedRoot(readSettings()), url.searchParams.get('p'))
        return
      }
      if (route === '/trash-file' && method === 'GET') {
        sendFile(req, res, trashRoot(readSettings()), url.searchParams.get('p'))
        return
      }
      if (method === 'POST') {
        const body = await readBody(req)
        if (route === '/generate') {
          const result = await generate(body)
          sendJson(res, 200, { ok: true, ...result })
          return
        }
        if (route === '/key') {
          sendJson(res, 200, keyAction(body))
          return
        }
        if (route === '/settings') {
          sendJson(res, 200, settingsAction(body))
          return
        }
        if (route === '/save') {
          // `stage: false` is how the model tool saves: it has no browser stage
          // to hand the picture back to, so the panel must not adopt it.
          sendJson(res, 200, savePicture(body, { stage: body?.stage !== false }))
          return
        }
        if (route === '/discard') {
          sendJson(res, 200, discardCached(body))
          return
        }
        if (route === '/history/delete') {
          sendJson(res, 200, deleteSaved(body))
          return
        }
        if (route === '/trash/restore') {
          sendJson(res, 200, restoreTrashed(body))
          return
        }
        if (route === '/trash/purge') {
          sendJson(res, 200, purgeTrashed(body))
          return
        }
        if (route === '/reveal') {
          sendJson(res, 200, await revealFolder(String(body?.path ?? '')))
          return
        }
        if (route === '/pick-folder') {
          sendJson(res, 200, await pickFolder())
          return
        }
      }
      sendJson(res, 404, { ok: false, message: 'not found' })
    } catch (error) {
      const status = error instanceof PanelError ? error.status : 500
      sendJson(res, status, { ok: false, message: error?.message ?? String(error) })
    }
  }
}

/**
 * Ask the composition for a directory through its own picker service. Nothing
 * here fabricates a chooser: without the service the panel keeps its text input.
 */
function pickFolder() {
  const controller = pickerService
  if (controller === undefined) throw new PanelError(501, '这个版本没有挂载原生目录选择器，直接填路径就行。')
  return controller.pick(new AbortController().signal)
}

/* ------------------------------------------------------------------- tool */

/**
 * The model-facing tool. Same request path as the panel, same windows, same
 * save folder — a tool call costs one image of the shared allowance and shows
 * up in the history page exactly like a click does.
 */
function toolDefinition(ctx) {
  return {
    name: 'kolors_image',
    description: 'Generate one picture with the free Kwai-Kolors/Kolors model on SiliconFlow and save it to the '
      + 'dsh-kolors-image folder. The model is fixed; only the prompt and a few parameters are open. '
      + 'The account allows 2 pictures per minute and 400 per day, so a call can be refused when the window is full.',
    // `tools.register` takes raw JSON Schema: requiredness is the object-level
    // `required` array, never a `required: true` on a property node.
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'What to draw. Chinese and English both work.' },
        size: {
          type: 'string',
          description: 'Canvas. Kolors accepts only these five values; default 1024x1024.',
          enum: SIZES.map((size) => size.id),
        },
        negative_prompt: { type: 'string', description: 'What must not appear in the picture.' },
        steps: { type: 'integer', description: 'Inference steps, 1-50; default 20. Higher is slower and usually finer.' },
        guidance: { type: 'number', description: 'Prompt adherence 0.1-20; default 7.5. Higher sticks closer to the prompt.' },
        seed: { type: 'integer', description: 'Random seed; omit for a fresh one. Reuse it to repeat a composition.' },
        watermark: { type: 'boolean', description: 'Draw the explicit "AI generated" watermark; default false (off).' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'size', 'prompt', 'minuteLeft', 'dayLeft'],
        properties: {
          path: { type: 'string', description: 'Absolute path of the saved PNG.' },
          size: { type: 'string' },
          seed: { type: 'integer' },
          prompt: { type: 'string' },
          keyLabel: { type: 'string' },
          minuteLeft: { type: 'integer' },
          dayLeft: { type: 'integer' },
          image: {
            type: 'object',
            additionalProperties: false,
            description: 'Durable attachment of the same picture, present when the store accepted it.',
            required: ['attachmentId', 'mediaType', 'bytes', 'width', 'height'],
            properties: {
              attachmentId: { type: 'string' },
              mediaType: { type: 'string' },
              bytes: { type: 'integer' },
              width: { type: 'integer' },
              height: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        },
      },
      render: (_args, value) => {
        const lines = [
          `<path>${value.path}</path>`,
          `<type>image</type>`,
          `<content>`,
          `Kwai-Kolors/Kolors, ${value.size}, seed ${value.seed ?? 'random'}`,
          `prompt: ${value.prompt}`,
          `quota left: ${value.minuteLeft} this minute, ${value.dayLeft} today`,
          `</content>`,
        ]
        const blocks = [{ type: 'text', text: lines.join('\n') }]
        if (value.image !== undefined) {
          blocks.push({ type: 'image', attachment: value.image })
        }
        return blocks
      },
      presentationMeta: (_args, value) => ({ path: value.path }),
    },
    isConcurrencySafe: () => false,
    timeoutMs: 240_000,
    presentCall(args) {
      return { card: 'generic', title: `Generate a picture: ${String(args.prompt ?? '').slice(0, 60)}`, kind: 'other' }
    },
    async execute(args, exec) {
      const { record, quota } = await generate(args, { signal: exec.signal })
      // A tool call has no browser stage, so the picture goes straight to the
      // history page; nothing is left waiting to be "saved" by a human.
      const saved = savePicture(record, { stage: false })
      const row = saved.saved
      // The image block is a bonus: a route without image input still gets the
      // path and the facts, so a text model can pass the file on.
      let image
      const attachments = ctx.get('attachments')
      if (attachments !== undefined) {
        try {
          const bytes = readFileSync(row.path)
          const ref = await attachments.saveImage({ data: new Uint8Array(bytes), mediaType: 'image/png', name: basename(row.path) })
          image = {
            attachmentId: ref.attachmentId,
            mediaType: ref.mediaType,
            bytes: ref.bytes,
            width: ref.width,
            height: ref.height,
            ...(ref.name === undefined ? {} : { name: ref.name }),
          }
        } catch {
          image = undefined
        }
      }
      return {
        path: row.path,
        size: row.size,
        ...(row.seed === null ? {} : { seed: row.seed }),
        prompt: row.prompt,
        keyLabel: row.keyLabel,
        minuteLeft: quota.minuteLeft,
        dayLeft: quota.dayLeft,
        ...(image === undefined ? {} : { image }),
      }
    },
  }
}

/* -------------------------------------------------------------- activation */

/**
 * Register the panel routes and the model tool. Both halves are optional so a
 * headless composition keeps loading the bundle without a web server or tools.
 */
export function apply(ctx) {
  if (typeof ctx.inject !== 'function') return

  // One clean scratch folder per process: a frame left behind by a previous run
  // is unreachable anyway, and leaving it on disk would only confuse a user who
  // went looking. Runs before any route can serve a frame.
  retireFrames()

  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => {
      const handler = createHandler()
      const unregister = webCtx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler })
      return () => unregister()
    }, 'dsh-kolors: /kolors routes')
  })

  ctx.inject(['directoryPickerController'], (pickCtx) => {
    pickCtx.effect(() => {
      pickerService = pickCtx.directoryPickerController
      pickerAvailable = true
      return () => {
        pickerService = undefined
        pickerAvailable = false
      }
    }, 'dsh-kolors: native folder chooser')
  })

  ctx.inject(['tools'], (toolCtx) => {
    toolCtx.effect(() => {
      try {
        const dispose = toolCtx.tools.register(toolDefinition(toolCtx))
        toolStatus.state = 'active'
        toolStatus.message = ''
        return dispose
      } catch (error) {
        toolStatus.state = 'failed'
        toolStatus.message = error?.message ?? String(error)
        throw error
      }
    }, 'dsh-kolors: kolors_image tool')
  })
}
