/**
 * Executes the real `fullPathOf` out of client.js against every row shape the
 * panel renders, so "复制文件路径" cannot silently go back to copying an empty
 * string. The function is lifted from the shipped source by name and evaluated
 * in isolation; nothing about it is re-typed here.
 *
 * Run with: node scripts/pathcheck.mjs
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

// Lift `function fullPathOf(item) { ... }` verbatim, matching braces.
const start = source.indexOf('function fullPathOf(item) {')
if (start === -1) {
  console.log('  FAIL fullPathOf is missing from client.js')
  process.exit(1)
}
let depth = 0
let end = -1
for (let index = source.indexOf('{', start); index < source.length; index += 1) {
  const char = source[index]
  if (char === '{') depth += 1
  else if (char === '}') {
    depth -= 1
    if (depth === 0) { end = index + 1; break }
  }
}
const body = source.slice(start, end)
const fullPathOf = new Function(`${body}; return fullPathOf`)()

console.log('\n[the path helper, executed]')

// The generate stage: the Host keys the frame by `file`, never `path`.
check(
  'a stage frame reports its file path',
  fullPathOf({ id: '1', file: 'C:\\Users\\me\\.dsh\\kolors-frames\\kolors-1-ab.png', src: '/kolors/frame?p=x' })
    === 'C:\\Users\\me\\.dsh\\kolors-frames\\kolors-1-ab.png',
  fullPathOf({ id: '1', file: 'C:\\Users\\me\\.dsh\\kolors-frames\\kolors-1-ab.png' }),
)

// A saved history row.
check(
  'a saved row reports its path',
  fullPathOf({ id: '2', path: 'C:\\Users\\me\\Pictures\\dsh-kolors-image\\kolors-1.png' })
    === 'C:\\Users\\me\\Pictures\\dsh-kolors-image\\kolors-1.png',
)

// A saved stage frame carries both; path wins because it is the filed copy.
check(
  'when both fields exist the filed path wins',
  fullPathOf({ file: 'C:\\old\\frame.png', path: 'C:\\filed\\kolors.png' }) === 'C:\\filed\\kolors.png',
  fullPathOf({ file: 'C:\\old\\frame.png', path: 'C:\\filed\\kolors.png' }),
)

// A trashed row is the same shape as a saved one.
check(
  'a trashed row reports its path',
  fullPathOf({ id: '3', path: 'C:\\Users\\me\\Pictures\\dsh-kolors-image\\dsh-kolors-trash\\kolors-2.png' })
    === 'C:\\Users\\me\\Pictures\\dsh-kolors-image\\dsh-kolors-trash\\kolors-2.png',
)

// Empty and unusable inputs must report empty, never a bare filename: the old
// code wrote '' to the clipboard and then claimed success.
check('an empty row reports empty', fullPathOf({}) === '', JSON.stringify(fullPathOf({})))
check('a null row reports empty', fullPathOf(null) === '')
check('an undefined row reports empty', fullPathOf(undefined) === '')
check('a bare filename is refused', fullPathOf({ path: 'kolors-1.png' }) === '', fullPathOf({ path: 'kolors-1.png' }))
check('a whitespace path is refused', fullPathOf({ path: '   ' }) === '')
check('a non-string path is refused', fullPathOf({ path: 42, file: null }) === '')

// The three absolute shapes the plugin actually produces.
check('a Windows drive path is accepted', fullPathOf({ path: 'D:\\pics\\a.png' }) === 'D:\\pics\\a.png')
check('a UNC share is accepted', fullPathOf({ path: '\\\\host\\share\\a.png' }) === '\\\\host\\share\\a.png')
check('a POSIX path is accepted', fullPathOf({ path: '/home/me/pics/a.png' }) === '/home/me/pics/a.png')
check('surrounding spaces are trimmed', fullPathOf({ path: '  C:\\pics\\a.png  ' }) === 'C:\\pics\\a.png')

// document.execCommand('copy') needs a selection that spans the whole value.
console.log('\n[the clipboard fallback]')
const fallbackStart = source.indexOf('function fallbackCopy(text) {')
const fallbackEnd = source.indexOf('\n    }', fallbackStart) + 6
const fallbackBody = source.slice(fallbackStart, fallbackEnd)
check('the fallback selects the whole value', /setSelectionRange\(0, text\.length\)/.test(fallbackBody))
check('the fallback removes its scratch node', /area\.remove\(\)/.test(fallbackBody))

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exitCode = fail === 0 ? 0 : 1
