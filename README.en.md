# dsh-kolors

Free image generation, built into the DeepSeek Harness sidebar. It runs the free `Kwai-Kolors/Kolors` model on SiliconFlow: no charge, no watermark, no model picker.

Completely free: Kolors itself costs nothing and this plugin charges nothing. The only requirement is a SiliconFlow balance ≥ 0, which is the platform's gate rather than a fee.

![The generate page](docs/screenshot-1.png)

[中文说明](README.zh.md)

## Install

```bash
dsh plugin add dsh-kolors
```

To skip npm, install straight from GitHub (requires `git` on the machine):

```bash
dsh plugin add github:kit686/dsh-kolors#v0.3.0
```

Both routes ship the same code. Or add it to a profile's dependencies, or paste the package name into **Plugins → Add plugin** inside DSH. The model is fixed at `Kwai-Kolors/Kolors`; there is no model picker.

Once installed, **Kolors Image** appears in the left sidebar. Open the Settings tab first and paste a [SiliconFlow](https://cloud.siliconflow.cn/) API key.

## What it does

- **Generate** — prompt, five canvases with a proportion preview, steps, guidance, negative prompt, seed, and a watermark switch; the stage can save, download, delete, or zoom.
- **History** — filter by 1 / 3 / 7 / 30 days or everything, multi-select and bulk delete, zoom, paging, reuse settings, download, copy path, plus a trash with restore, purge, and empty.
- **Settings** — a key pool with rotation (one key is fine too), the picture folder (typed or chosen with the native picker), and one-click opening of both folders.

An unsaved picture lives only in this page: switching tabs, switching to another sidebar page, and reloading all keep it; closing DSH clears it.
You do not have to sit and watch a generation — switch away and it finishes in the background, with a dot on the tab when the picture is ready.

Allowance: 2 pictures per minute and 400 per day per key, gated locally as well, with counters persisted across restarts.

The plugin also registers a `kolors_image` tool so the model can draw inside a conversation, sharing the same allowance and the same save folder.

## Files on this machine

| Path | Purpose |
|---|---|
| `~/.dsh/secrets/kolors.env` | API keys (mode 600) |
| `~/.dsh/dsh-kolors.json` | Output folder, last used parameters, key metadata, usage, the picture on the stage |
| `~/.dsh/kolors-frames/` | The bytes behind the stage picture; the UI never points at it, and it is cleared on restart |
| `<output folder>/dsh-kolors-image/` | Saved pictures plus `index.json` |
| `<output folder>/dsh-kolors-image/dsh-kolors-trash/` | The trash plus `index.json`, capped at 2000 pictures; the oldest is deleted along with its file |

With no folder configured the plugin uses `~/Pictures` when it exists, and the home directory otherwise.

## Limits

- Kolors is free, but the platform requires a non-negative balance; an empty wallet answers 402.
- An upstream image URL lives for one hour, so the picture is downloaded immediately after generation.
- Only `1024x1024`, `960x1280`, `768x1024`, `720x1440`, and `720x1280` canvases exist.
- Inference steps cap at 50 (upstream `code 20015`), prompts at 4000 characters, negative prompts at 2000.
- An embedded webview swallows `target="_blank"`; use **Download** or **Copy path** instead of a new tab.

## Development

```bash
git clone https://github.com/kit686/dsh-kolors.git
cd dsh-kolors
dsh plugin add ./dsh-kolors          # or link: it into a profile
```

Editing `client.js` takes effect on a page reload; editing `index.js` (the Host half) needs a DSH restart.

## Checks

CI runs `npm run check`: four offline suites, 200+ assertions, no network and no dependencies.

| Command | What it covers |
|---|---|
| `npm run check` | Everything offline: syntax + selftest + clientaudit + tabswitch + pathcheck |
| `node scripts/selftest.mjs` | Host half: key pool, quota windows, save / history / trash / restore / purge, surviving a tab switch, clearing on restart, path escapes, plugin assembly, request body decoding, the trash ceiling, image streaming and 304 |
| `node scripts/clientaudit.mjs` | Browser half, static: module shape, identifiers, zh/en dictionary parity, theme tokens, hook dependencies, the copy-path branches, background job ownership |
| `node scripts/tabswitch.mjs` | Runs `client.js` for real: mounts the page, clicks generate, switches away, lands the request, switches back |
| `node scripts/tabswitch-old.mjs` | Runs the same harness against the previous `client.js`, proving it catches the bug |
| `node scripts/pathcheck.mjs` | Runs `fullPathOf` against all three row shapes |
| `node scripts/toolschema.mjs` | Validates the `kolors_image` schema with the real `dsh-tools` (needs a running Harness) |
| `node scripts/livecheck.mjs` | Hits the running plugin: save, history, trash, restore, purge, image streaming, path escapes (needs a running Harness) |

## License

MIT
