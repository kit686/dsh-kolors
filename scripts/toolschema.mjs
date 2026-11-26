/**
 * Validate the tool definition against the *real* registry checks, using the
 * installed dsh-tools package: `assertSupportedJsonSchema` on both schemas and
 * a fake `tools.register` that runs the same guards.
 *
 * Run with: node scripts/toolschema.mjs
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'kolors-schema-'))

const installDir = process.env.DSH_INSTALL_DIR
if (installDir === undefined) {
  console.log('skip: DSH_INSTALL_DIR is not set (this check needs the installed Harness)')
  process.exit(0)
}

const candidates = [
  join(installDir, '..', 'dsh-tools', 'lib', 'index.js'),
  join(installDir, 'node_modules', '@deepseek-ai', 'dsh-tools', 'lib', 'index.js'),
]
const { existsSync } = await import('node:fs')
const toolsPath = candidates.find((path) => existsSync(path))
if (toolsPath === undefined) {
  console.log(`skip: dsh-tools not found beside ${installDir}`)
  process.exit(0)
}
const toolsUrl = pathToFileURL(toolsPath).href

const tools = await import(toolsUrl)
const bundle = await import(pathToFileURL(join(import.meta.dirname, '..', 'index.js')).href)

let pass = 0
let fail = 0
const check = (label, ok, detail) => {
  if (ok) { pass += 1; console.log(`  ok  ${label}`) }
  else { fail += 1; console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`) }
}

const captured = []
const ctx = {
  inject(names, run) {
    const services = {}
    for (const name of names) {
      services[name] = name === 'webServer'
        ? { register() { return () => {} } }
        : {
            register(definition) {
              // The real guards from the installed package: `register` asserts
              // the output schema, and the legacy-shaped `parameters` field is a
              // complete JSON Schema that the model receives verbatim.
              const output = definition.output
              if (output === undefined || typeof output.render !== 'function') {
                throw new TypeError(`tool "${definition.name}" must declare output { schema, render }`)
              }
              tools.assertSupportedJsonSchema(output.schema)
              tools.assertSupportedJsonSchema(definition.parameters)
              captured.push(definition)
              return () => {}
            },
          }
    }
    run({ ...services, effect(fn) { return fn() }, get() { return undefined } })
  },
}

bundle.apply(ctx)

check('the tool registered without a schema rejection', captured.length === 1, JSON.stringify(captured.map((tool) => tool.name)))

const tool = captured[0]
if (tool !== undefined) {
  check('parameters is an object root', tool.parameters.type === 'object')
  check('output schema is an object root', tool.output.schema.type === 'object')
  check('no model parameter exists', tool.parameters.properties.model === undefined)
  check('name is kolors_image', tool.name === 'kolors_image')

  // Valid argument passes, an unknown key fails.
  const good = tools.validateJsonSchemaValue(tool.parameters, { prompt: '猫', size: '720x1440', steps: 20 }, '')
  check('valid arguments validate', good.length === 0, JSON.stringify(good))
  const missing = tools.validateJsonSchemaValue(tool.parameters, { size: '720x1440' }, '')
  check('a missing prompt is rejected', missing.length > 0, JSON.stringify(missing))
  const extra = tools.validateJsonSchemaValue(tool.parameters, { prompt: '猫', model: 'Qwen/Qwen-Image' }, '')
  check('an injected model key is rejected', extra.length > 0, JSON.stringify(extra))
  const badSize = tools.validateJsonSchemaValue(tool.parameters, { prompt: '猫', size: '1920x1080' }, '')
  check('a canvas outside the five is rejected', badSize.length > 0, JSON.stringify(badSize))

  const goodOut = tools.validateJsonSchemaValue(tool.output.schema, {
    path: 'C:/x.png', size: '1024x1024', prompt: '猫', minuteLeft: 1, dayLeft: 399,
  }, '')
  check('a valid output value validates', goodOut.length === 0, JSON.stringify(goodOut))
  const badOut = tools.validateJsonSchemaValue(tool.output.schema, { path: 'C:/x.png' }, '')
  check('an incomplete output value is rejected', badOut.length > 0, JSON.stringify(badOut))
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
