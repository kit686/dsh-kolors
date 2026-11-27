/**
 * Browser half of dsh-kolors.
 *
 * One navigation row in `sidebar.panellist` plus one page body in `main`,
 * keyed by the same id — the pair the shipped Plugins page and the media desk
 * use, so the panel behaves like a built-in page instead of a floating card:
 *
 *   sidebar.panellist { id, order, label } -> the icon row
 *   main              { key }              -> the page body
 *
 * Three tabs in the page: 生图 / 历史 / Key. The model is fixed by the Host
 * half, so this file has no model picker at all.
 *
 * Hand-authored in the module-loader format; React comes from the browser
 * module table, colors are theme tokens only.
 */
window.__ModuleLoader__.load({
  id: 'dsh-kolors',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const h = React.createElement

    const STYLE_ID = 'dsh-kolors-style'
    const PANEL_ID = 'kolors'
    const NS = 'dshKolors'
    const PREF_KEY = 'dsh-kolors.draft'

    /** Both baseline locales live here; the host locale service picks one. */
    const COPY = {
      zh: {
        panel: 'Kolors生图',
        title: 'Kolors 生图',
        subtitle: '硅基流动免费模型，每分钟 2 张、每天 400 张',
        'tab.generate': '生图', 'tab.history': '历史', 'tab.settings': '设置',
        'tab.unseen': '新图已经出好了，切回生图页看',
        'browse.detached': '已切到别的页面，出图照常进行，回来就能看到。',
        'quota.minute': '本分钟剩 {n} 张', 'quota.day': '今日剩 {n} 张',
        'quota.none': '额度已用完', 'quota.pool': '{k} 个 Key',
        'state.reading': '读取中…', 'state.offline': '连不上本地服务',
        'guide.noKey': '还没配 Key。先去 Key 页粘贴一个硅基流动的 Key，回来就能出图。',
        'guide.goKey': '去配 Key',
        'guide.noRoom': '当前额度用完了：每 Key 每分钟 2 张。等一分钟，或者在 Key 页再加一个。',
        'guide.retry': '再试一次',
        'section.prompt': '提示词', 'section.params': '可调参数', 'section.browse': '浏览',
        'placeholder.prompt': '描述你想要的画面，比如「雨夜街角，霓虹倒影，35mm 电影感」',
        'hint.prompt': '⌘/Ctrl + Enter 直接生成。中文英文都可以。',
        generate: '生成', 'generate.running': '生成中…', 'generate.again': '再生成一张',
        'error.title': '这一张没成。',
        retry: '重试',
        'browse.empty': '生成的第一张会出现在这里。',
        'browse.empty.body': '左边写完提示词，按「生成」。',
        'browse.busy': '一般十几秒，慢的时候会久一点。',
        save: '保存', 'save.done': '已保存', 'save.saving': '保存中…',
        delete: '删除', 'delete.done': '预览已清空',
        'zoom.open': '放大查看', 'zoom.close': '关闭', 'zoom.prev': '上一张', 'zoom.next': '下一张',
        'zoom.saveAs': '下载这张', 'zoom.copyPath': '复制文件路径', 'zoom.pathCopied': '路径已复制',
        'zoom.pathCopiedTemp': '路径已复制（保存后才会长期保留）',
        'zoom.pathMissing': '这张还没存成文件', 'zoom.pathFailed': '复制被拦住了',
        'params.size': '尺寸', 'params.size.hint': 'Kolors 只认这五档，别的一律报错。',
        'params.steps': '推理步数', 'params.steps.hint': '默认 20，上限 50。步数越高越细，也越慢。',
        'params.guidance': '提示词贴合度', 'params.guidance.hint': '默认 7.5。越高越严格照提示词画，越低越放飞。',
        'params.negative': '反向提示词', 'params.negative.hint': '不想出现的东西写这里，可以不填。',
        'params.negative.placeholder': '比如：模糊、低清、多余的手指、水印',
        'params.seed': '种子', 'params.seed.hint': '留空就是随机。填同一个数字可以复现构图。',
        'params.seed.placeholder': '随机',
        'params.watermark': '带「AI 生成」显式水印', 'params.watermark.hint': '默认关闭。关了以后图片本身不带角标。',
        'params.reset': '恢复默认值',
        'size.1024x1024': '方图', 'size.960x1280': '竖图',
        'size.768x1024': '小竖图', 'size.720x1440': '长图', 'size.720x1280': '手机壁纸',
        'history.days': '最近 {n} 天保存的图',
        'history.days.all': '全部保存过的图',
        'history.folder': '保存位置：{p}',
        'history.empty': '这个时间范围里还没有保存过图。',
        'history.empty.body': '在「生图」页生成后按「保存」，图会进到这里。',
        'history.count': '共 {n} 张',
        'history.reuse': '复用参数', 'history.copy': '复制提示词', 'history.copied': '已复制',
        'history.delete': '删除', 'history.confirm': '确认删除', 'history.truncated': '只显示最近 {n} 张',
        'window.label': '时间范围', 'window.days': '最近 {n} 天', 'window.all': '全部',
        'sel.all': '全选', 'sel.none': '取消选择', 'sel.count': '已选 {n} 张', 'sel.delete': '删除所选',
        'trash.title': '回收站', 'trash.count': '{n} 张',
        'trash.empty': '回收站是空的。删掉的图会先来这里，随时能恢复。',
        'trash.selectOne': '选中这张',
        'trash.restore': '恢复', 'trash.purge': '彻底删除',
        'trash.purgeAll': '清空回收站', 'trash.purgeConfirm': '确认清空',
        'trash.deletedAt': '删除于',
        'folder.open': '打开图片文件夹', 'folder.openTrash': '打开回收站',
        'folder.opened': '已在文件管理器里打开。',
        'folder.downloaded': '已交给浏览器下载。',
        'key.title': 'API Key 池',
        'key.note': 'Key 只写进本机 ~/.dsh/secrets/kolors.env（权限 600），不上传，也不用于生图以外的用途。额度按账号算，加多个 Key 就是把每 Key 的 400 张/天叠起来。',
        'key.add': '添加', 'key.placeholder': '粘贴硅基流动的 Key（sk-…）',
        'key.labelPlaceholder': '备注名（可留空）',
        'key.remove': '移除', 'key.enable': '启用', 'key.disable': '停用',
        'key.replace': '换 Key', 'key.replacePlaceholder': '粘贴新 Key（留空表示不改）',
        'key.keep': '保存', 'key.cancel': '取消', 'key.added': '已保存', 'key.confirmRemove': '确认移除',
        'key.used': '本分钟 {m}/2 · 今日 {d}/400',
        'key.missing': '未填 Key', 'key.disabled': '已停用', 'key.exhausted': '额度用尽',
        'key.none': '还没有 Key。粘贴一个就能开始。',
        'key.get': '去硅基流动拿 Key ↗',
        'dir.title': '图片保存位置',
        'dir.note': '在默认位置下会自动建一个 dsh-kolors-image 文件夹，历史页读的就是它。',
        'dir.label': '目录',
        'dir.save': '保存路径', 'dir.saved': '路径已保存', 'dir.bad': '请填绝对路径',
        'dir.browse': '浏览…', 'dir.open': '打开这个目录',
        'dir.folders': '目录说明',
        'dir.foldersNote': '只有两个目录，都在你选的保存位置下面。保存过的图进「图片」，删掉的图进「回收站」，两个都能在文件管理器里打开。',
        'dir.savedFolder': '图片', 'dir.trashFolder': '回收站',
        'model.locked': '固定模型 Kwai-Kolors/Kolors（免费）',
        'note.limit': '免费额度：每 Key 每分钟 2 张、每天 400 张。平台要求账户余额不小于 0，余额见底会报 402。',
      },
      en: {
        panel: 'Kolors Image',
        title: 'Kolors image desk',
        subtitle: 'Free SiliconFlow model — 2 a minute, 400 a day',
        'tab.generate': 'Generate', 'tab.history': 'History', 'tab.settings': 'Settings',
        'tab.unseen': 'Your picture is ready — switch back to Generate',
        'browse.detached': 'You moved to another page; the picture keeps cooking and will be here when you come back.',
        'quota.minute': '{n} left this minute', 'quota.day': '{n} left today',
        'quota.none': 'Out of allowance', 'quota.pool': '{k} keys',
        'state.reading': 'Loading…', 'state.offline': 'Local service unreachable',
        'guide.noKey': 'No key yet. Paste a SiliconFlow key on the Keys tab and come back.',
        'guide.goKey': 'Add a key',
        'guide.noRoom': 'The allowance is spent: 2 a minute per key. Wait a minute, or add another key.',
        'guide.retry': 'Try again',
        'section.prompt': 'Prompt', 'section.params': 'Parameters', 'section.browse': 'Preview',
        'placeholder.prompt': 'Describe the picture, e.g. "a rainy street corner, neon reflections, 35mm film look"',
        'hint.prompt': '⌘/Ctrl + Enter generates. Chinese and English both work.',
        generate: 'Generate', 'generate.running': 'Generating…', 'generate.again': 'Generate another',
        'error.title': 'That one failed.',
        retry: 'Retry',
        'browse.empty': 'Your first picture lands here.',
        'browse.empty.body': 'Write a prompt on the left, then press Generate.',
        'browse.busy': 'Usually ten seconds or so; sometimes slower.',
        save: 'Save', 'save.done': 'Saved', 'save.saving': 'Saving…',
        delete: 'Delete', 'delete.done': 'Preview cleared',
        'zoom.open': 'Zoom in', 'zoom.close': 'Close', 'zoom.prev': 'Previous', 'zoom.next': 'Next',
        'zoom.saveAs': 'Download this', 'zoom.copyPath': 'Copy file path', 'zoom.pathCopied': 'Path copied',
        'zoom.pathCopiedTemp': 'Path copied (kept only after Save)',
        'zoom.pathMissing': 'Not a file yet', 'zoom.pathFailed': 'Copy was blocked',
        'params.size': 'Canvas', 'params.size.hint': 'Kolors accepts exactly these five; anything else is rejected.',
        'params.steps': 'Inference steps', 'params.steps.hint': 'Default 20, max 50. More steps, finer and slower.',
        'params.guidance': 'Prompt adherence', 'params.guidance.hint': 'Default 7.5. Higher sticks closer to the prompt.',
        'params.negative': 'Negative prompt', 'params.negative.hint': 'What must not appear. Optional.',
        'params.negative.placeholder': 'e.g. blurry, low quality, extra fingers, watermark',
        'params.seed': 'Seed', 'params.seed.hint': 'Empty is random. The same number repeats a composition.',
        'params.seed.placeholder': 'random',
        'params.watermark': 'Draw the explicit "AI generated" watermark', 'params.watermark.hint': 'Off by default, so the picture carries no corner label.',
        'params.reset': 'Reset to defaults',
        'size.1024x1024': 'Square', 'size.960x1280': 'Portrait',
        'size.768x1024': 'Small portrait', 'size.720x1440': 'Tall', 'size.720x1280': 'Phone',
        'history.days': 'Saved in the last {n} days',
        'history.days.all': 'Everything saved',
        'history.folder': 'Saving to {p}',
        'history.empty': 'Nothing saved in this range.',
        'history.empty.body': 'Generate on the Generate tab, then press Save.',
        'history.count': '{n} pictures',
        'history.reuse': 'Reuse settings', 'history.copy': 'Copy prompt', 'history.copied': 'Copied',
        'history.delete': 'Delete', 'history.confirm': 'Confirm delete', 'history.truncated': 'Showing the newest {n}',
        'window.label': 'Time range', 'window.days': 'Last {n} d', 'window.all': 'All',
        'sel.all': 'Select all', 'sel.none': 'Select none', 'sel.count': '{n} selected', 'sel.delete': 'Delete selected',
        'trash.title': 'Trash', 'trash.count': '{n} pictures',
        'trash.empty': 'The trash is empty. Deleted pictures wait here first, ready to restore.',
        'trash.selectOne': 'Select this picture',
        'trash.restore': 'Restore', 'trash.purge': 'Delete forever',
        'trash.purgeAll': 'Empty the trash', 'trash.purgeConfirm': 'Confirm empty',
        'trash.deletedAt': 'deleted',
        'folder.open': 'Open the picture folder', 'folder.openTrash': 'Open the trash',
        'folder.opened': 'Opened in your file manager.',
        'folder.downloaded': 'Handed to the browser download.',
        'key.title': 'API key pool',
        'key.note': 'Keys are written only to ~/.dsh/secrets/kolors.env (mode 600) on this machine. They are never uploaded, and never used for anything but generating. The allowance is per account, so extra keys stack their 400-a-day.',
        'key.add': 'Add', 'key.placeholder': 'Paste a SiliconFlow key (sk-…)',
        'key.labelPlaceholder': 'Name (optional)',
        'key.remove': 'Remove', 'key.enable': 'Enable', 'key.disable': 'Disable',
        'key.replace': 'Replace', 'key.replacePlaceholder': 'New key (empty keeps the current one)',
        'key.keep': 'Save', 'key.cancel': 'Cancel', 'key.added': 'Saved', 'key.confirmRemove': 'Confirm remove',
        'key.used': '{m}/2 this minute · {d}/400 today',
        'key.missing': 'No key', 'key.disabled': 'Disabled', 'key.exhausted': 'Allowance spent',
        'key.none': 'No keys yet. Paste one to start.',
        'key.get': 'Get a key at SiliconFlow ↗',
        'dir.title': 'Where pictures go',
        'dir.note': 'A dsh-kolors-image folder is created inside it, and the History tab reads that folder.',
        'dir.label': 'Directory',
        'dir.save': 'Save path', 'dir.saved': 'Path saved', 'dir.bad': 'Use an absolute path',
        'dir.browse': 'Browse…', 'dir.open': 'Open this folder',
        'dir.folders': 'The folders',
        'dir.foldersNote': 'Just two, both under the output directory you pick. Saved pictures go to Pictures; deleted pictures go to Trash. Each has its own button.',
        'dir.savedFolder': 'Pictures', 'dir.trashFolder': 'Trash',
        'model.locked': 'Fixed model: Kwai-Kolors/Kolors (free)',
        'note.limit': 'Free allowance: 2 per minute and 400 per day per key. The platform also requires a balance of at least 0, so an empty account answers 402.',
      },
    }

    // Replaced with the host-bound translate() once apply() sees the locale
    // service; the fallback keeps the bundle renderable on its own.
    let t = (key, params) => {
      const template = COPY.zh[key] ?? key
      if (params === undefined) return template
      return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
    }
    let localeCtx = null

    function useLocale() {
      const [, bump] = React.useState(0)
      React.useEffect(() => {
        if (localeCtx === null || typeof localeCtx.subscribe !== 'function') return undefined
        return localeCtx.subscribe(() => bump((n) => n + 1))
      }, [])
    }

    const DEFAULT_PARAMS = { size: '1024x1024', steps: 20, guidance: 7.5, negative: '', watermark: false }

    /** Fallback table; the Host sends the authoritative one with each state read. */
    const SIZE_FALLBACK = [
      { id: '1024x1024', ratio: '1:1', label: '方图' },
      { id: '960x1280', ratio: '3:4', label: '竖图' },
      { id: '768x1024', ratio: '3:4', label: '竖图 · 小' },
      { id: '720x1440', ratio: '1:2', label: '长图' },
      { id: '720x1280', ratio: '9:16', label: '手机壁纸' },
    ]

    const CSS = `
.dshk-page {
  height: 100%; overflow: auto; box-sizing: border-box;
  padding: calc(var(--dsh-frame-top-clearance, 48px) + 20px) 40px 48px;
  color: var(--dsw-alias-label-primary, #0f1115);
  font-family: var(--dsw-font-family, -apple-system, "PingFang SC", system-ui, sans-serif);
}
.dshk-inner { max-width: 1080px; margin: 0 auto; }
.dshk-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.dshk-head h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: .01em; }
.dshk-head p { margin: 7px 0 0; font-size: 13px; color: var(--dsw-alias-label-tertiary, #81858c); }
.dshk-meters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.dshk-meter {
  font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); border-radius: 12px;
  padding: 4px 10px; color: var(--dsw-alias-label-secondary, #61666b);
}
.dshk-meter[data-low="true"] { color: var(--dsw-alias-state-warn-primary, #b4610f); border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b4610f) 42%, transparent); }
.dshk-meter[data-off="true"] { color: var(--dsw-alias-label-caption, #adb2b8); }
.dshk-lock {
  display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary, #81858c); margin-top: 10px;
}
.dshk-lock svg { flex: none; }

.dshk-tabs { display: flex; gap: 24px; margin-top: 22px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06)); }
.dshk-tab {
  font: inherit; font-size: 14px; color: var(--dsw-alias-label-tertiary, #81858c);
  background: none; border: 0; padding: 0 0 10px; cursor: pointer; position: relative;
}
.dshk-tab[data-on="true"] { color: var(--dsw-alias-label-primary, #0f1115); font-weight: 500; }
.dshk-tab[data-on="true"]::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px;
  background: var(--dsw-alias-label-primary, #0f1115); border-radius: 1px;
}

.dshk-split { display: grid; grid-template-columns: minmax(340px, 460px) 1fr; gap: 34px; margin-top: 24px; align-items: start; }
@media (max-width: 940px) { .dshk-split { grid-template-columns: 1fr; gap: 22px; } }

.dshk-card { border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); border-radius: 14px; padding: 16px; }
.dshk-card + .dshk-card { margin-top: 16px; }
.dshk-card h2 { margin: 0 0 12px; font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-secondary, #61666b); letter-spacing: .02em; }
.dshk-card .sub { margin: 0 0 10px; font-size: 12px; line-height: 1.7; color: var(--dsw-alias-label-tertiary, #81858c); }

.dshk-field {
  width: 100%; min-height: 112px; resize: vertical; box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); border-radius: 10px;
  background: var(--dsw-alias-bg-base, #fff); color: inherit;
  font: inherit; font-size: 14px; line-height: 1.65; padding: 12px 14px; outline: none;
}
.dshk-field:focus { border-color: var(--dsw-alias-label-tertiary, #81858c); }
.dshk-field::placeholder { color: var(--dsw-alias-label-caption, #adb2b8); }
.dshk-field.small { min-height: 62px; font-size: 13px; }

.dshk-guide {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  margin-bottom: 12px; padding: 10px 14px; border-radius: 10px;
  border: 1px dashed var(--dsw-alias-border-l2, rgba(0,0,0,.16));
  background: var(--dsw-alias-bg-layer-2, #f2f3f5);
  font-size: 12.5px; line-height: 1.6; color: var(--dsw-alias-label-secondary, #61666b);
}
.dshk-guide .dshk-ghost { flex: none; height: 28px; }
.dshk-note { margin: 9px 0 0; font-size: 12px; line-height: 1.7; color: var(--dsw-alias-label-tertiary, #81858c); }
.dshk-note[data-tone="ok"] { color: var(--dsw-alias-state-success-primary, #2f7d5c); }
.dshk-ghost[data-armed="true"] { color: var(--dsw-alias-state-error-primary, #c0392b); }

/* Time-range chips above the history grid. */
.dshk-chips { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dshk-chip {
  height: 28px; padding: 0 12px; border-radius: 14px; cursor: pointer; font: inherit; font-size: 12.5px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); background: none;
  color: var(--dsw-alias-label-secondary, #61666b); white-space: nowrap;
}
.dshk-chip:hover { border-color: var(--dsw-alias-label-caption, #adb2b8); }
.dshk-chip[data-on="true"] {
  border-color: transparent; background: var(--dsw-alias-button-primary-fill, #0f1115);
  color: var(--dsw-alias-label-primary-foreground, #fff); font-weight: 500;
}

/* Selection toolbar shared by the history grid and the trash. */
.dshk-selbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.dshk-selbar .dshk-ghost { height: 28px; }
.dshk-selcount { font-size: 12px; color: var(--dsw-alias-label-tertiary, #81858c); font-variant-numeric: tabular-nums; }

/* One selectable tile: the picture, its caption, and its checkbox. */
.dshk-tile { position: relative; min-width: 0; }
.dshk-tile .dshk-work { width: 100%; }
.dshk-tile[data-selected="true"] .im { box-shadow: 0 0 0 2px var(--dsw-alias-label-primary, #0f1115); }
.dshk-check { position: absolute; top: 8px; right: 8px; display: flex; cursor: pointer; }
.dshk-check input { position: absolute; width: 20px; height: 20px; margin: 0; opacity: 0; cursor: pointer; }
.dshk-check .box {
  width: 18px; height: 18px; border-radius: 5px; box-sizing: border-box;
  border: 1.4px solid var(--dsw-alias-border-l3, rgba(0,0,0,.3));
  background: var(--dsw-alias-bg-base, #fff);
  display: flex; align-items: center; justify-content: center;
}
.dshk-check input:checked + .box {
  background: var(--dsw-alias-button-primary-fill, #0f1115);
  border-color: transparent;
}
.dshk-check input:checked + .box::after {
  content: ""; width: 9px; height: 5px; border-left: 1.8px solid var(--dsw-alias-label-primary-foreground, #fff);
  border-bottom: 1.8px solid var(--dsw-alias-label-primary-foreground, #fff);
  transform: rotate(-45deg) translate(1px, -1px);
}
.dshk-check input:focus-visible + .box { box-shadow: 0 0 0 2px var(--dsw-alias-label-tertiary, #81858c); }

/* The trash section header. */
.dshk-trashhead { margin-top: 34px; padding-top: 20px; border-top: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06)); }
.dshk-trashhead h2 { margin: 0; display: inline-block; font-size: 15px; font-weight: 600; }
.dshk-trashhead .sub { margin-left: 8px; font-size: 12px; color: var(--dsw-alias-label-tertiary, #81858c); }
.dshk-trashhead .path { margin: 4px 0 0; font-size: 11.5px; color: var(--dsw-alias-label-caption, #adb2b8); word-break: break-all; }

/* One folder path per line on the settings page. */
.dshk-pathline {
  margin: 6px 0 0; font-size: 11.5px; line-height: 1.6; word-break: break-all;
  color: var(--dsw-alias-label-tertiary, #81858c); font-variant-numeric: tabular-nums;
}

.dshk-sizes { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; }
@media (max-width: 940px) { .dshk-sizes { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.dshk-size {
  display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 3px 9px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); border-radius: 10px;
  background: none; cursor: pointer; font: inherit; color: var(--dsw-alias-label-tertiary, #81858c);
  min-width: 0; overflow: hidden;
}
.dshk-size:hover { border-color: var(--dsw-alias-label-caption, #adb2b8); }
.dshk-size[data-on="true"] {
  border-color: var(--dsw-alias-label-primary, #0f1115);
  color: var(--dsw-alias-label-primary, #0f1115);
  background: var(--dsw-alias-bg-layer-2, #f2f3f5);
}
.dshk-glyphbox { display: flex; align-items: center; justify-content: center; width: 28px; height: 30px; flex: none; }
.dshk-glyph { border: 1.4px solid currentColor; border-radius: 2.5px; opacity: .85; }
/* The Chinese nickname is the label the user reads; the pixel id stays a tooltip. */
.dshk-size .d { font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.dshk-size .r { font-size: 10px; opacity: .7; font-variant-numeric: tabular-nums; }

.dshk-param { margin-top: 16px; }
.dshk-param .lab { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 12.5px; color: var(--dsw-alias-label-secondary, #61666b); }
.dshk-param .val { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary, #0f1115); font-size: 12.5px; }
.dshk-range { width: 100%; margin: 8px 0 0; accent-color: var(--dsw-alias-label-primary, #0f1115); }
.dshk-input {
  width: 100%; box-sizing: border-box; height: 32px; padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); border-radius: 8px;
  background: var(--dsw-alias-bg-base, #fff); color: inherit; font: inherit; font-size: 13px; outline: none;
}
.dshk-input:focus { border-color: var(--dsw-alias-label-tertiary, #81858c); }
.dshk-row { display: flex; align-items: center; gap: 10px; }
.dshk-row.between { justify-content: space-between; }
.dshk-row.wrap { flex-wrap: wrap; }

.dshk-switch {
  display: inline-flex; align-items: center; gap: 9px; cursor: pointer; font: inherit;
  font-size: 12.5px; color: var(--dsw-alias-label-secondary, #61666b); background: none; border: 0; padding: 0;
}
.dshk-switch .track {
  width: 34px; height: 20px; border-radius: 10px; flex: none; position: relative;
  background: var(--dsw-alias-border-l3, rgba(0,0,0,.2)); transition: background .14s ease;
}
.dshk-switch .knob {
  position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
  background: var(--dsw-alias-bg-base, #fff); box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform .14s ease;
}
.dshk-switch[data-on="true"] .track { background: var(--dsw-alias-button-primary-fill, #0f1115); }
.dshk-switch[data-on="true"] .knob { transform: translateX(14px); }

.dshk-cta {
  margin-top: 18px; height: 38px; border-radius: 19px; border: 0; cursor: pointer; width: 100%;
  background: var(--dsw-alias-button-primary-fill, #0f1115); color: var(--dsw-alias-label-primary-foreground, #fff);
  font: inherit; font-size: 14px; font-weight: 500;
}
.dshk-cta:disabled { background: var(--dsw-alias-bg-layer-2, #f2f3f5); color: var(--dsw-alias-label-caption, #adb2b8); cursor: not-allowed; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); }
.dshk-ghost {
  height: 30px; padding: 0 14px; border-radius: 15px; cursor: pointer; font: inherit; font-size: 12.5px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); background: none;
  color: var(--dsw-alias-label-secondary, #61666b);
  display: inline-flex; align-items: center; gap: 6px; text-decoration: none;
}
.dshk-ghost:hover { border-color: var(--dsw-alias-label-caption, #adb2b8); color: var(--dsw-alias-label-primary, #0f1115); }
.dshk-ghost[data-danger="true"]:hover { color: var(--dsw-alias-state-error-primary, #c0392b); border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #c0392b) 42%, transparent); }
.dshk-ghost:disabled { opacity: .5; cursor: default; }
.dshk-ghost[data-primary="true"] {
  border-color: transparent; background: var(--dsw-alias-button-primary-fill, #0f1115);
  color: var(--dsw-alias-label-primary-foreground, #fff);
}
.dshk-ghost[data-primary="true"]:disabled {
  background: var(--dsw-alias-bg-layer-2, #f2f3f5); color: var(--dsw-alias-label-caption, #adb2b8);
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); opacity: 1;
}

.dshk-stage {
  border-radius: 14px; background: var(--dsw-alias-bg-layer-2, #f2f3f5);
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  min-height: 320px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12));
}
.dshk-stage img { max-width: 100%; max-height: 560px; object-fit: contain; display: block; }
.dshk-emptystage {
  padding: 60px 24px; text-align: center; font-size: 13px; line-height: 1.7;
  color: var(--dsw-alias-label-caption, #adb2b8);
}
.dshk-emptystage b { display: block; font-size: 14px; font-weight: 500; color: var(--dsw-alias-label-secondary, #61666b); margin-bottom: 6px; }
.dshk-spin { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 24px; font-size: 12.5px; color: var(--dsw-alias-label-tertiary, #81858c); }
.dshk-ring {
  width: 26px; height: 26px; border-radius: 50%;
  border: 2px solid var(--dsw-alias-border-l3, rgba(0,0,0,.18));
  border-top-color: var(--dsw-alias-label-primary, #0f1115);
  animation: dshk-spin .9s linear infinite;
}
@keyframes dshk-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .dshk-ring { animation: none; } }

/* A job that is still running, or a finished frame waiting on a tab the user
   is not looking at: the tab strip has to say so, or the work is invisible. */
.dshk-ring.mini { width: 11px; height: 11px; border-width: 1.5px; display: inline-block; margin-left: 6px; vertical-align: -1px; }
.dshk-dot {
  display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-left: 6px; vertical-align: 1px;
  background: var(--dsw-alias-brand-primary, #0f1115);
}

.dshk-stagefoot { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.dshk-stagefoot .spacer { flex: 1; }
.dshk-meta { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--dsw-alias-label-tertiary, #81858c); font-variant-numeric: tabular-nums; }
.dshk-meta .p { font-size: 13px; line-height: 1.7; color: var(--dsw-alias-label-secondary, #61666b); white-space: pre-wrap; word-break: break-word; max-height: 110px; overflow: auto; }
.dshk-err {
  margin-top: 12px; border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #c0392b) 35%, transparent); border-radius: 10px; padding: 12px 14px;
  font-size: 12.5px; line-height: 1.65; color: var(--dsw-alias-state-error-primary, #b0362a); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #c0392b) 9%, transparent);
}
.dshk-err b { display: block; font-weight: 600; margin-bottom: 4px; }

.dshk-zoom {
  position: fixed; inset: 0; z-index: 60; background: rgba(8,9,11,.88);
  display: flex; align-items: center; justify-content: center; padding: 44px 44px 70px; cursor: zoom-out;
}
.dshk-zoom img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px; box-shadow: 0 24px 64px rgba(0,0,0,.45); }
.dshk-arrow {
  position: absolute; top: 50%; transform: translateY(-50%); width: 40px; height: 56px;
  display: flex; align-items: center; justify-content: center; padding: 0; cursor: pointer;
  border: 0; border-radius: 10px; background: rgba(255,255,255,.1); color: #f2f3f5;
  font: inherit; font-size: 26px; line-height: 1;
}
.dshk-arrow:hover { background: rgba(255,255,255,.2); }
.dshk-arrow.left { left: 8px; }
.dshk-arrow.right { right: 8px; }
.dshk-zoombar button[data-danger="true"], .dshk-zoombar button[data-armed="true"] { border-color: rgba(255,140,130,.65); color: #ff9d92; }
.dshk-zoombar button[data-tone="bad"] { border-color: rgba(255,190,120,.7); color: #ffcf9d; }
/* A clipboard the webview blocked: the path is shown so Ctrl+C still works. */
.dshk-zoompath {
  position: absolute; left: 50%; bottom: 58px; transform: translateX(-50%);
  width: min(760px, calc(100% - 88px)); box-sizing: border-box;
  padding: 9px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,.34);
  background: rgba(20,22,26,.92); color: #f2f3f5; font: inherit; font-size: 12.5px; outline: none;
}
.dshk-zoombar {
  position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px; max-width: calc(100% - 88px);
  color: #f2f3f5; font-size: 12.5px; cursor: default;
}
.dshk-zoombar span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .82; }
.dshk-zoombar a, .dshk-zoombar button {
  flex: none; color: inherit; background: none; border: 1px solid rgba(255,255,255,.3); border-radius: 14px;
  height: 28px; padding: 0 12px; font: inherit; font-size: 12.5px; cursor: pointer; text-decoration: none;
  display: inline-flex; align-items: center;
}
.dshk-zoombar a:hover, .dshk-zoombar button:hover { border-color: rgba(255,255,255,.62); }

.dshk-hist { margin-top: 24px; }
.dshk-hist .sub { margin: 0 0 4px; font-size: 12.5px; color: var(--dsw-alias-label-secondary, #61666b); }
.dshk-hist .path { margin: 0; font-size: 11.5px; color: var(--dsw-alias-label-caption, #adb2b8); word-break: break-all; }
.dshk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; margin-top: 18px; }
.dshk-work { text-align: left; background: none; border: 0; padding: 0; cursor: zoom-in; font: inherit; color: inherit; }
.dshk-work .im { border-radius: 10px; overflow: hidden; background: var(--dsw-alias-bg-layer-2, #f2f3f5); aspect-ratio: 1 / 1; transition: box-shadow .12s ease; }
.dshk-work:hover .im { box-shadow: 0 0 0 2px var(--dsw-alias-border-l3, rgba(0,0,0,.26)); }
.dshk-work img { width: 100%; height: 100%; object-fit: contain; display: block; }
.dshk-work .tt { margin-top: 8px; font-size: 12.5px; color: var(--dsw-alias-label-secondary, #61666b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dshk-work .mm { margin-top: 3px; font-size: 11.5px; color: var(--dsw-alias-label-caption, #adb2b8); font-variant-numeric: tabular-nums; }

.dshk-keys { margin-top: 24px; display: grid; gap: 12px; max-width: 720px; }
.dshk-krow { border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); border-radius: 12px; padding: 14px 16px; display: grid; gap: 10px; }
.dshk-krow .kh { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dshk-krow .kh .nm { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dshk-krow .kh .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--dsw-alias-state-success-primary, #2f7d5c); }
.dshk-krow[data-off="true"] .kh .dot { background: var(--dsw-alias-label-caption, #adb2b8); }
.dshk-krow[data-bad="true"] .kh .dot { background: var(--dsw-alias-state-error-primary, #c0392b); }
.dshk-krow .kh .nm b { font-size: 13.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshk-krow .kh .hint { font-size: 11.5px; color: var(--dsw-alias-label-caption, #adb2b8); font-variant-numeric: tabular-nums; }
.dshk-krow .kf { font-size: 11.5px; color: var(--dsw-alias-label-tertiary, #81858c); font-variant-numeric: tabular-nums; }
.dshk-krow .acts { display: flex; gap: 6px; flex-wrap: wrap; }
.dshk-add { display: flex; gap: 8px; align-items: flex-start; }
.dshk-add .grow { flex: 1; display: grid; gap: 8px; }
.dshk-note-block {
  border: 1px dashed var(--dsw-alias-border-l2, rgba(0,0,0,.14)); border-radius: 12px;
  padding: 14px 16px; font-size: 12px; line-height: 1.7; color: var(--dsw-alias-label-tertiary, #81858c); max-width: 720px;
}
.dshk-warn { margin-top: 14px; font-size: 12px; line-height: 1.7; color: var(--dsw-alias-label-tertiary, #81858c); max-width: 720px; }
`

    function ensureStyles() {
      let style = document.getElementById(STYLE_ID)
      if (style === null) {
        style = document.createElement('style')
        style.id = STYLE_ID
        document.head.appendChild(style)
      }
      // Client HMR can swap this bundle live; keep the sheet in step with the
      // code that is actually running instead of reusing the previous build's.
      if (style.textContent !== CSS) style.textContent = CSS
    }

    /**
     * The sidebar glyph: a picture frame with a sparkle, so the row reads as
     * "make an image" rather than "upload a file".
     */
    function PanelIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
      },
        h('rect', { x: 1.6, y: 2.9, width: 12.8, height: 10.6, rx: 2 }),
        h('path', { d: 'M1.9 10.9l3.1-2.7 2.2 1.9 1.8-1.5' }),
        h('path', { d: 'M11.9 4.4l.45 1.1 1.1.45-1.1.45-.45 1.1-.45-1.1-1.1-.45 1.1-.45z' }))
    }

    function LockIcon() {
      return h('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('rect', { x: 4, y: 10.5, width: 16, height: 10.5, rx: 2.4 }),
        h('path', { d: 'M8 10.5V7.4a4 4 0 0 1 8 0v3.1' }))
    }

    async function api(path, init) {
      const response = await fetch(`/kolors${path}`, {
        headers: { 'content-type': 'application/json' },
        ...init,
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        const error = new Error(body.message ?? `HTTP ${response.status}`)
        error.status = response.status
        throw error
      }
      return body
    }

    function post(path, payload) {
      return api(path, { method: 'POST', body: JSON.stringify(payload ?? {}) })
    }

    function copyText(text) {
      if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text))
      }
      return Promise.resolve(fallbackCopy(text))
    }

    function fallbackCopy(text) {
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.style.position = 'fixed'
        area.style.top = '-1000px'
        document.body.appendChild(area)
        area.focus()
        area.select()
        area.setSelectionRange(0, text.length)
        const ok = document.execCommand('copy')
        area.remove()
        return ok === true
      } catch {
        return false
      }
    }

    /**
     * The absolute path of one picture, whichever name the row uses.
     *
     * The history and trash rows carry `path`; the frame on the generate stage
     * carries `file` (that is what the Host keyed it by). Both are the same
     * absolute string, and only a row that has neither — a picture that has not
     * been saved yet and whose scratch copy is already gone — reports empty.
     */
    function fullPathOf(item) {
      if (item === null || item === undefined) return ''
      const raw = typeof item.path === 'string' && item.path !== '' ? item.path : item.file
      if (typeof raw !== 'string') return ''
      const clean = raw.trim()
      if (clean === '') return ''
      // A bare name is not a path the user can paste into a file manager.
      return /^[A-Za-z]:[\\/]/.test(clean) || clean.startsWith('\\\\') || clean.startsWith('/') ? clean : ''
    }

    /**
     * One draft, remembered so a reload inside the same app run keeps the
     * prompt. It carries the Host's boot id: a draft written by a previous run
     * is discarded on sight, which is what makes "close the app and the prompt
     * is gone" true without needing a timer or a guess.
     */
    function readDraft() {
      try {
        const raw = JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}')
        return typeof raw === 'object' && raw !== null ? raw : {}
      } catch {
        return {}
      }
    }

    function writeDraft(draft) {
      try { localStorage.setItem(PREF_KEY, JSON.stringify(draft)) } catch { /* storage blocked */ }
    }

    function whenOf(at) {
      const date = new Date(at)
      const pad = (n) => String(n).padStart(2, '0')
      return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    function shortOf(text, max) {
      const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
      return clean.length > max ? `${clean.slice(0, max)}…` : clean
    }

    /** The canvas glyph on the size buttons: the ratio drawn to scale. */
    function glyphOf(id, box) {
      const match = /^(\d+)x(\d+)$/.exec(String(id))
      const width = match === null ? 1 : Number(match[1])
      const height = match === null ? 1 : Number(match[2])
      const k = box / Math.max(width, height)
      return h('span', {
        className: 'dshk-glyph',
        style: { width: `${Math.max(6, Math.round(width * k))}px`, height: `${Math.max(6, Math.round(height * k))}px` },
      })
    }

    /** The localized nickname for one canvas; the Host table is the fallback. */
    function sizeName(id, fallback) {
      const key = `size.${id}`
      const localized = t(key)
      if (localized !== key) return localized
      return typeof fallback === 'string' && fallback !== '' ? fallback : String(id).replace('x', '×')
    }

    function Meter({ label, low }) {
      return h('span', { className: 'dshk-meter', 'data-low': String(low === true) }, label)
    }

    /** A labelled slider that keeps the raw number visible next to its caption. */
    function Slider({ label, value, min, max, step, hint, format, onChange }) {
      return h('div', { className: 'dshk-param' },
        h('div', { className: 'lab' },
          h('span', null, label),
          h('span', { className: 'val' }, format === undefined ? String(value) : format(value))),
        h('input', {
          className: 'dshk-range', type: 'range', min, max, step,
          value, onChange: (event) => onChange(Number(event.target.value)),
        }),
        hint === undefined ? null : h('p', { className: 'dshk-note' }, hint))
    }

    /** The panel's only switch; `role="switch"` keeps it announced correctly. */
    function Switch({ on, label, hint, onToggle }) {
      return h('div', { className: 'dshk-param' },
        h('button', {
          type: 'button', className: 'dshk-switch', role: 'switch', 'aria-checked': String(on === true),
          'data-on': String(on === true), onClick: () => onToggle(on !== true),
        },
          h('span', { className: 'track' }, h('span', { className: 'knob' })),
          h('span', null, label)),
        hint === undefined ? null : h('p', { className: 'dshk-note' }, hint))
    }

    /**
     * The picture lightbox. An embedded webview silently ignores
     * `target="_blank"`, so "open the original" has to be a same-document
     * action: the image is streamed by the Host either way, and the browser can
     * save it from the lightbox instead of opening a tab that never appears.
     */
    function Zoom({ item, onClose, onDownload }) {
      React.useEffect(() => {
        const escape = (event) => { if (event.key === 'Escape') onClose() }
        document.addEventListener('keydown', escape)
        return () => document.removeEventListener('keydown', escape)
      }, [onClose])
      const [copyState, setCopyState] = React.useState('')
      // A saved row names its file `path`; the frame on the generate stage names
      // the same thing `file`. Reading only one of them is why the contract on
      // the live stage copied nothing at all.
      const realPath = fullPathOf(item)
      // An unfiled frame still has a real absolute path, but it lives in the
      // scratch folder and dies with the app — say so instead of pretending the
      // copy is permanent.
      const transient = typeof item.path !== 'string' || item.path === ''
      const copyPath = () => {
        if (realPath === '') {
          setCopyState('missing')
          window.setTimeout(() => setCopyState(''), 2400)
          return
        }
        copyText(realPath).then((ok) => {
          setCopyState(ok ? (transient ? 'doneTemp' : 'done') : 'failed')
          window.setTimeout(() => setCopyState(''), 2600)
        })
      }
      const copyLabel = copyState === 'done'
        ? t('zoom.pathCopied')
        : copyState === 'doneTemp'
          ? t('zoom.pathCopiedTemp')
          : copyState === 'missing'
            ? t('zoom.pathMissing')
            : copyState === 'failed'
              ? t('zoom.pathFailed')
              : t('zoom.copyPath')
      // A blocked clipboard is the one failure the user can finish by hand: show
      // the path selected so Ctrl+C still works. Without this the button reads as
      // broken even though the value is right there.
      const reveal = copyState === 'failed' && realPath !== ''
      return h('div', { className: 'dshk-zoom', onClick: onClose },
        h('img', { src: item.src, alt: item.prompt ?? '' }),
        reveal
          ? h('input', {
              className: 'dshk-zoompath', value: realPath, readOnly: true, spellCheck: false,
              onFocus: (event) => event.target.select(),
              ref: (node) => { if (node !== null) { node.focus(); node.select() } },
              onClick: (event) => event.stopPropagation(),
            })
          : null,
        h('div', { className: 'dshk-zoombar', onClick: (event) => event.stopPropagation() },
          h('span', null, `${whenOf(item.at)} · ${item.size ?? ''}`),
          onDownload === undefined ? null : h('button', { type: 'button', onClick: () => onDownload(item) }, t('zoom.saveAs')),
          h('button', {
            type: 'button', onClick: copyPath, title: realPath,
            'data-tone': copyState === 'failed' || copyState === 'missing' ? 'bad' : undefined,
          }, copyLabel),
          h('button', { type: 'button', onClick: onClose }, t('zoom.close'))))
    }

    /* ------------------------------------------------------------ generate */

    /**
     * The generation job, and the frame it produces, outlive the tab body that
     * started them.
     *
     * Switching to another tab unmounts that body. The request itself is only a
     * promise, so it kept running and the Host kept working — but `setBusy` and
     * `setResult` arriving afterwards landed on an unmounted component and were
     * dropped. The picture was written to disk, the allowance was spent, and the
     * page never learned about either: the spinner vanished, the frame never
     * appeared, and the quota meter stayed stale. That is the "generation gets
     * interrupted when I click elsewhere" bug, and it is a state-ownership bug,
     * not a network one.
     *
     * So the job lives here at module scope, where an unmount cannot reach it:
     * the fetch runs to completion, the record is written to STAGE, and whichever
     * body is mounted next reads the same record. Nothing ever aborts a request
     * in flight; the only thing that stops a generation is the Host.
     */
    const STAGE = {
      busy: false,
      error: null,
      errorStatus: 0,
      // The unsaved frame on the table, or null. Survives a tab switch, a panel
      // switch, and a remount; the Host's own `lastPreview` pointer covers a
      // full reload.
      result: null,
      // The boot id the held frame belongs to. A frame from a previous Host
      // process is a dead file, so a new boot id retires it instead of showing
      // a broken image.
      boot: '',
      // Set when a frame lands while the generate tab is not on screen. The tab
      // label carries a dot so a finished job cannot go unnoticed, and mounting
      // the tab clears it.
      unseen: false,
      // Whether the generate tab is mounted right now; a completion reads this
      // to decide if the frame is news.
      viewing: false,
      // The seed box is a draft that belongs to the job, not to the tab body:
      // a tab switch must not quietly drop a seed the user typed in.
      seed: '',
      // Filled in by the page while it is mounted. A completion that lands after
      // the last unmount updates nothing, and the fresh mount reads the frame
      // back from the Host instead — which is why these are optional.
      hooks: { onQuota: undefined, onDone: undefined },
      listeners: new Set(),
    }

    /**
     * Write STAGE and repaint whoever is subscribed.
     *
     * `silent` is for a write nobody renders: on unmount the child's cleanup
     * runs while the page above it is being torn down too, and waking a listener
     * that is on its way out buys nothing.
     */
    function stageSet(patch, silent = false) {
      Object.assign(STAGE, patch)
      if (silent) return
      for (const listener of [...STAGE.listeners]) listener()
    }

    /** Re-render on every change to STAGE; the object identity never changes. */
    function useStage() {
      const [, bump] = React.useState(0)
      React.useEffect(() => {
        const listener = () => bump((count) => count + 1)
        STAGE.listeners.add(listener)
        return () => { STAGE.listeners.delete(listener) }
      }, [])
      return STAGE
    }

    /**
     * One generation, started here rather than inside the tab body so a tab or
     * panel switch cannot orphan it. Returns immediately; progress is in STAGE.
     */
    async function runGenerate(request) {
      if (STAGE.busy) return
      const previous = STAGE.result
      stageSet({ busy: true, error: null, errorStatus: 0 })
      try {
        const seedText = String(request.seed ?? '').trim()
        const body = await post('/generate', {
          prompt: request.prompt,
          size: request.params.size,
          steps: request.params.steps,
          guidance: request.params.guidance,
          negative_prompt: request.params.negative,
          seed: seedText === '' ? undefined : Number(seedText),
          watermark: request.params.watermark,
        })
        // The old frame is dropped only after the new one landed, so a slow
        // failure never costs the picture the user was already looking at. A
        // filed frame is not thrown away: it already lives in the save folder
        // and belongs to the history page now.
        if (previous !== null && previous.filed !== true) {
          post('/discard', { file: previous.file }).catch(() => {})
        }
        stageSet({
          result: body.record,
          boot: typeof body.record?.boot === 'string' ? body.record.boot : STAGE.boot,
          // The frame is news only if nobody was looking at the stage when it
          // landed; the tab that is on screen marks it seen on mount.
          unseen: STAGE.viewing !== true,
        })
        if (body.quota !== undefined && STAGE.hooks.onQuota !== undefined) STAGE.hooks.onQuota(body.quota)
        post('/settings', { params: request.params }).catch(() => {})
        if (STAGE.hooks.onDone !== undefined) STAGE.hooks.onDone()
      } catch (failure) {
        stageSet({ error: failure.message, errorStatus: typeof failure.status === 'number' ? failure.status : 0 })
      } finally {
        stageSet({ busy: false })
      }
    }

    function GenerateTab({
      state, onSaved, onGoKey, onDownload, params, setParams, prompt, setPrompt,
      onTrashChanged,
    }) {
      const stage = useStage()
      const busy = stage.busy
      const result = stage.result
      const error = stage.error
      const errorStatus = stage.errorStatus
      const [saving, setSaving] = React.useState(false)
      const [notice, setNotice] = React.useState('')
      const [zoom, setZoom] = React.useState(null)
      // The seed box is not component state: a tab switch unmounts this body,
      // and a seed the user typed in must not come back empty. Same reason the
      // frame and the job live in STAGE.
      const seedText = stage.seed
      const setSeedText = (value) => stageSet({ seed: value })
      // "Already filed" is a property of the frame itself, not of this component:
      // a tab switch remounts this body, and the button must still read 已保存.
      const saved = result !== null && result.filed === true

      /**
       * This body owns the "someone is looking at the stage" flag. It is how a
       * completion knows whether the new frame is news, and it clears the dot
       * the tab shows while the user is elsewhere.
       */
      React.useEffect(() => {
        stageSet({ viewing: true, unseen: false })
        return () => { stageSet({ viewing: false }, true) }
      }, [])

      const sizes = Array.isArray(state?.sizes) && state.sizes.length > 0 ? state.sizes : SIZE_FALLBACK
      const dayLeft = state?.quota?.dayLeft
      const keyCount = Array.isArray(state?.keys)
        ? state.keys.filter((key) => key.enabled !== false && key.configured).length
        : 0
      // Only a loaded state can prove the pool is empty; an unreachable service
      // must not silently disable the button, it must fail with a message.
      const loaded = state !== null
      const blocked = loaded && dayLeft <= 0

      // Nothing here awaits the request: the job is in runGenerate, which keeps
      // running after this body is unmounted. All this does is hand it the
      // current draft.
      const generate = () => {
        if (busy || prompt.trim() === '') return
        setNotice('')
        runGenerate({ prompt, params, seed: seedText })
      }

      const save = async () => {
        if (result === null || saved || saving) return
        setSaving(true)
        stageSet({ error: null, errorStatus: 0 })
        try {
          const body = await post('/save', {
            file: result.file,
            prompt: result.prompt,
            negative: result.negative,
            size: result.size,
            steps: result.steps,
            guidance: result.guidance,
            seed: result.seed,
            watermark: result.watermark,
            at: result.at,
            keyLabel: result.keyLabel,
          })
          // The scratch copy is gone the moment the save lands, so the picture
          // on screen switches to the filed copy instead of a dead URL. `filed`
          // rides on the frame itself, so a tab switch keeps 已保存 visible.
          const filed = body?.saved
          if (filed !== undefined && typeof filed.src === 'string') {
            stageSet({
              result: {
                ...result,
                id: filed.id,
                src: filed.src,
                path: filed.path,
                name: filed.name,
                filed: true,
              },
            })
          }
          onSaved()
        } catch (failure) {
          stageSet({ error: failure.message, errorStatus: typeof failure.status === 'number' ? failure.status : 0 })
        } finally {
          setSaving(false)
        }
      }

      /**
       * Deleting the frame hands its bytes to the trash folder. Nothing is
       * unlinked: the picture is recoverable from the History page, and the
       * scratch copy disappears with it.
       */
      const discard = async () => {
        if (result === null) return
        try {
          await post('/discard', {
            file: result.file,
            prompt: result.prompt,
            negative: result.negative,
            size: result.size,
            steps: result.steps,
            guidance: result.guidance,
            seed: result.seed,
            watermark: result.watermark,
            at: result.at,
            keyLabel: result.keyLabel,
            origin: 'preview',
          })
        } catch {
          /* the frame goes away either way */
        }
        stageSet({ result: null })
        onTrashChanged()
        setNotice(t('delete.done'))
        window.setTimeout(() => setNotice(''), 2400)
      }

      const onKeyDown = (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          generate()
        }
      }

      // First-run guidance: the CTA alone cannot explain why it is unavailable.
      let guide = null
      if (loaded && keyCount === 0) {
        guide = h('div', { className: 'dshk-guide' },
          h('span', null, t('guide.noKey')),
          h('button', { type: 'button', className: 'dshk-ghost', 'data-primary': 'true', onClick: onGoKey }, t('guide.goKey')))
      } else if (blocked) {
        guide = h('div', { className: 'dshk-guide' },
          h('span', null, t('guide.noRoom')),
          h('button', { type: 'button', className: 'dshk-ghost', onClick: onGoKey }, t('guide.goKey')))
      }

      const left = h('div', null,
        guide,
        h('div', { className: 'dshk-card' },
          h('h2', null, t('section.prompt')),
          h('textarea', {
            className: 'dshk-field', value: prompt, spellCheck: false,
            placeholder: t('placeholder.prompt'),
            onChange: (event) => setPrompt(event.target.value),
            onKeyDown,
          }),
          h('p', { className: 'dshk-note' }, t('hint.prompt'))),
        h('div', { className: 'dshk-card' },
          h('h2', null, t('section.params')),
          h('div', { className: 'dshk-param', style: { marginTop: 0 } },
            h('div', { className: 'lab' },
              h('span', null, t('params.size')),
              h('span', { className: 'val' }, String(params.size).replace('x', '×')))),
          h('div', { className: 'dshk-sizes' }, sizes.map((size) =>
            h('button', {
              key: size.id, type: 'button', className: 'dshk-size',
              'data-on': String(size.id === params.size),
              'aria-pressed': String(size.id === params.size),
              onClick: () => setParams({ ...params, size: size.id }),
              title: `${size.id} · ${size.ratio}`,
            },
              h('span', { className: 'dshk-glyphbox' }, glyphOf(size.id, 26)),
              h('span', { className: 'd' }, sizeName(size.id, size.label)),
              h('span', { className: 'r' }, size.id.replace('x', '×'))))),
          h('p', { className: 'dshk-note' }, t('params.size.hint')),
          h(Slider, {
            label: t('params.steps'), value: params.steps, min: 1, max: 50, step: 1,
            hint: t('params.steps.hint'),
            onChange: (steps) => setParams({ ...params, steps }),
          }),
          h(Slider, {
            label: t('params.guidance'), value: params.guidance, min: 0.1, max: 20, step: 0.1,
            hint: t('params.guidance.hint'), format: (value) => Number(value).toFixed(1),
            onChange: (guidance) => setParams({ ...params, guidance }),
          }),
          h('div', { className: 'dshk-param' },
            h('div', { className: 'lab' }, h('span', null, t('params.negative'))),
            h('textarea', {
              className: 'dshk-field small', value: params.negative, spellCheck: false,
              placeholder: t('params.negative.placeholder'),
              onChange: (event) => setParams({ ...params, negative: event.target.value }),
            }),
            h('p', { className: 'dshk-note' }, t('params.negative.hint'))),
          h('div', { className: 'dshk-param' },
            h('div', { className: 'lab' }, h('span', null, t('params.seed'))),
            h('input', {
              className: 'dshk-input', value: seedText, inputMode: 'numeric',
              placeholder: t('params.seed.placeholder'),
              onChange: (event) => setSeedText(event.target.value.replace(/[^\d]/g, '')),
            }),
            h('p', { className: 'dshk-note' }, t('params.seed.hint'))),
          h(Switch, {
            on: params.watermark === true, label: t('params.watermark'), hint: t('params.watermark.hint'),
            onToggle: (watermark) => setParams({ ...params, watermark }),
          }),
          h('div', { className: 'dshk-row', style: { marginTop: 14 } },
            h('button', {
              type: 'button', className: 'dshk-ghost',
              onClick: () => { setParams({ ...DEFAULT_PARAMS }); setSeedText('') },
            }, t('params.reset')))),
        h('button', {
          type: 'button', className: 'dshk-cta',
          disabled: busy || blocked || prompt.trim() === '',
          onClick: generate,
        }, busy ? t('generate.running') : result !== null ? t('generate.again') : t('generate')))

      let stageBody
      if (busy) {
        stageBody = h('div', { className: 'dshk-spin' },
          h('span', { className: 'dshk-ring' }),
          h('span', null, t('browse.busy')))
      } else if (result !== null) {
        stageBody = h('button', {
          type: 'button', className: 'dshk-work', style: { display: 'block', width: '100%' },
          onClick: () => setZoom(result), title: t('zoom.open'),
        }, h('img', { src: result.src, alt: result.prompt, style: { maxHeight: 560, maxWidth: '100%', margin: '0 auto' } }))
      } else {
        stageBody = h('div', { className: 'dshk-emptystage' },
          h('b', null, t('browse.empty')),
          t('browse.empty.body'))
      }

      const foot = result !== null && !busy
        ? h('div', { className: 'dshk-stagefoot' },
            h('button', {
              type: 'button', className: 'dshk-ghost', 'data-primary': 'true',
              disabled: saved || saving, onClick: save,
            }, saving ? t('save.saving') : saved ? t('save.done') : t('save')),
            h('button', { type: 'button', className: 'dshk-ghost', onClick: () => setZoom(result) }, t('zoom.open')),
            h('span', { className: 'spacer' }),
            // The destructive action sits at the far end, away from save.
            saved
              ? null
              : h('button', {
                  type: 'button', className: 'dshk-ghost', 'data-danger': 'true', 'data-armed': 'true',
                  onClick: discard,
                }, t('delete')))
        : null

      const meta = result !== null && !busy
        ? h('div', { className: 'dshk-meta' },
            h('span', null, `${result.size.replace('x', '×')} · ${result.steps} 步 · ${Number(result.guidance).toFixed(1)} · seed ${result.seed ?? '随机'}`),
            h('span', null, `${whenOf(result.at)} · ${result.keyLabel ?? ''} ${result.keyHint ?? ''}${result.watermark === true ? ' · 带水印' : ''}`),
            h('div', { className: 'p' }, result.prompt))
        : null

      // A failed call explains itself and offers the one useful next step.
      let errorBox = null
      if (error !== null) {
        const action = errorStatus === 401 || errorStatus === 403
          ? h('button', { type: 'button', className: 'dshk-ghost', onClick: onGoKey }, t('guide.goKey'))
          : h('button', { type: 'button', className: 'dshk-ghost', onClick: generate }, t('guide.retry'))
        errorBox = h('div', { className: 'dshk-err' },
          h('b', null, t('error.title')),
          h('div', null, error),
          h('div', { className: 'dshk-row', style: { marginTop: 10 } }, action))
      }

      return h('div', { className: 'dshk-split' },
        left,
        h('div', null,
          h('div', { className: 'dshk-card' },
            h('h2', null, t('section.browse')),
            h('div', { className: 'dshk-stage' }, stageBody),
            foot,
            notice === '' ? null : h('p', { className: 'dshk-note', 'data-tone': 'ok' }, notice),
            errorBox,
            meta),
          zoom === null ? null : h(Zoom, { item: zoom, onClose: () => setZoom(null), onDownload })))
    }

    /* ------------------------------------------------------------- history */

    /** The time-window chips; 0 is "everything". */
    function WindowChips({ days, windows, onChange }) {
      const label = (value) => (value === 0 ? t('window.all') : t('window.days', { n: value }))
      return h('div', { className: 'dshk-chips', role: 'group', 'aria-label': t('window.label') },
        (windows ?? [1, 3, 7, 30, 0]).map((value) =>
          h('button', {
            key: value, type: 'button', className: 'dshk-chip',
            'data-on': String(days === value), 'aria-pressed': String(days === value),
            onClick: () => onChange(value),
          }, label(value))))
    }

    /** One selectable picture tile; the same tile serves history and trash. */
    function PictureTile({ item, selected, onToggle, onOpen }) {
      return h('div', { className: 'dshk-tile', 'data-selected': String(selected === true) },
        h('button', {
          type: 'button', className: 'dshk-work', onClick: () => onOpen(item), title: item.prompt,
        },
          h('div', { className: 'im' }, h('img', { src: item.src, alt: shortOf(item.prompt, 40) })),
          h('div', { className: 'tt' }, shortOf(item.prompt, 18)),
          h('div', { className: 'mm' },
            `${whenOf(item.origin === 'preview' || item.deletedAt !== undefined ? item.deletedAt ?? item.at : item.at)}`
            + ` · ${String(item.size ?? '').replace('x', '×')}`)),
        h('label', { className: 'dshk-check' },
          h('input', {
            type: 'checkbox', checked: selected === true,
            'aria-label': t('trash.selectOne'),
            onChange: () => onToggle(item.id),
          }),
          h('span', { className: 'box' })))
    }

    /** A grid plus its selection toolbar; used by both lists. */
    function SelectionBar({ count, total, onAll, onNone, children }) {
      return h('div', { className: 'dshk-selbar' },
        h('button', { type: 'button', className: 'dshk-ghost', onClick: onAll, disabled: total === 0 }, t('sel.all')),
        h('button', { type: 'button', className: 'dshk-ghost', onClick: onNone, disabled: count === 0 }, t('sel.none')),
        h('span', { className: 'dshk-selcount' }, t('sel.count', { n: count })),
        h('span', { className: 'spacer' }),
        children)
    }

    function HistoryTab(props) {
      const {
        items, state, total, truncated, days, windows, onDaysChange,
        trash, trashTotal, onReuse, onReload, onReveal, onDownload,
      } = props
      const [zoom, setZoom] = React.useState(null)
      const [copied, setCopied] = React.useState('')
      const [zoomCopy, setZoomCopy] = React.useState('')
      const [confirming, setConfirming] = React.useState('')
      const confirmTimer = React.useRef(null)
      const [picked, setPicked] = React.useState([])
      const [trashPicked, setTrashPicked] = React.useState([])
      const [trashConfirm, setTrashConfirm] = React.useState('')

      const copy = (item) => {
        copyText(item.prompt ?? '').then((ok) => {
          if (!ok) return
          setCopied(item.id)
          window.setTimeout(() => setCopied(''), 1600)
        })
      }

      /**
       * Copy the absolute path of the picture in the lightbox. The history and
       * trash rows both carry `path`, but the shared helper also covers a row
       * that only has `file`, and it refuses an empty string instead of writing
       * one to the clipboard and claiming success.
       */
      const copyZoomPath = () => {
        const realPath = fullPathOf(zoom)
        if (realPath === '') {
          setZoomCopy('missing')
          window.setTimeout(() => setZoomCopy(''), 2400)
          return
        }
        copyText(realPath).then((ok) => {
          setZoomCopy(ok ? 'done' : 'failed')
          window.setTimeout(() => setZoomCopy(''), 2400)
        })
      }

      const toggle = (list, setList, id) => {
        setList(list.includes(id) ? list.filter((value) => value !== id) : [...list, id])
      }

      const armConfirm = (id) => {
        if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current)
        setConfirming(id)
        confirmTimer.current = window.setTimeout(() => {
          setConfirming('')
          confirmTimer.current = null
        }, 3200)
      }

      const remove = (item) => {
        if (confirming !== item.id) {
          armConfirm(item.id)
          return
        }
        if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current)
        confirmTimer.current = null
        setConfirming('')
        post('/history/delete', { id: item.id }).then(() => {
          setZoom(null)
          onReload()
        }).catch(() => { /* the next refresh shows the truth */ })
      }

      const removePicked = () => {
        if (picked.length === 0) return
        post('/history/delete', { ids: picked }).then(() => {
          setZoom(null)
          setPicked([])
          onReload()
        }).catch(() => {})
      }

      const restorePicked = () => {
        if (trashPicked.length === 0) return
        post('/trash/restore', { ids: trashPicked }).then(() => {
          setZoom(null)
          setTrashPicked([])
          onReload()
        }).catch(() => {})
      }

      const purgePicked = (all) => {
        if (!all && trashPicked.length === 0) return
        if (all && trashConfirm !== 'all') {
          setTrashConfirm('all')
          window.setTimeout(() => setTrashConfirm(''), 3200)
          return
        }
        setTrashConfirm('')
        post('/trash/purge', all ? { all: true } : { ids: trashPicked }).then(() => {
          setZoom(null)
          setTrashPicked([])
          onReload()
        }).catch(() => {})
      }

      const move = (list, item, delta) => {
        if (list.length === 0) return
        const index = list.findIndex((row) => row.id === item.id)
        const next = list[(index + delta + list.length) % list.length]
        if (next !== undefined) setZoom(next)
      }

      const allItems = [...items, ...(trash ?? [])]

      React.useEffect(() => {
        if (zoom === null) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') setZoom(null)
          const inTrash = (trash ?? []).some((row) => row.id === zoom.id)
          if (event.key === 'ArrowLeft') move(inTrash ? trash : items, zoom, 1)
          if (event.key === 'ArrowRight') move(inTrash ? trash : items, zoom, -1)
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [zoom, items, trash])

      // A zoomed picture is a modal: stop the page behind it from scrolling.
      React.useEffect(() => {
        if (zoom === null) return undefined
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = previous }
      }, [zoom === null])

      React.useEffect(() => () => {
        if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current)
      }, [])

      const inTrashList = zoom !== null && (trash ?? []).some((row) => row.id === zoom.id)

      const head = h('div', null,
        h('div', { className: 'dshk-row wrap', style: { marginTop: 20, gap: 10 } },
          h(WindowChips, { days, windows, onChange: onDaysChange }),
          h('span', { className: 'spacer' }),
          h('button', { type: 'button', className: 'dshk-ghost', onClick: () => onReveal(state?.folder) }, t('folder.open')),
          h('button', { type: 'button', className: 'dshk-ghost', onClick: () => onReveal(state?.trashDir) }, t('folder.openTrash'))),
        h('p', { className: 'sub', style: { marginTop: 12 } },
          days === 0 ? t('history.days.all') : t('history.days', { n: days }),
          items.length === 0 ? '' : ` · ${t('history.count', { n: total ?? items.length })}`),
        h('p', { className: 'path' }, t('history.folder', { p: state?.folder ?? '' })),
        truncated === true ? h('p', { className: 'path' }, t('history.truncated', { n: items.length })) : null)

      const historyBody = items.length === 0
        ? h('div', { className: 'dshk-card', style: { marginTop: 14 } },
            h('div', { className: 'dshk-emptystage' },
              h('b', null, t('history.empty')),
              t('history.empty.body')))
        : h(React.Fragment, null,
            h(SelectionBar, {
              count: picked.length, total: items.length,
              onAll: () => setPicked(items.map((item) => item.id)),
              onNone: () => setPicked([]),
            },
              h('button', {
                type: 'button', className: 'dshk-ghost', 'data-danger': 'true', 'data-armed': 'true',
                disabled: picked.length === 0, onClick: removePicked,
              }, t('sel.delete'))),
            h('div', { className: 'dshk-grid' }, items.map((item) =>
              h(PictureTile, {
                key: item.id, item, selected: picked.includes(item.id),
                onToggle: (id) => toggle(picked, setPicked, id),
                onOpen: setZoom,
              }))))

      const trashBody = (trash ?? []).length === 0
        ? h('div', { className: 'dshk-card' },
            h('div', { className: 'dshk-emptystage' }, t('trash.empty')))
        : h(React.Fragment, null,
            h(SelectionBar, {
              count: trashPicked.length, total: trash.length,
              onAll: () => setTrashPicked(trash.map((item) => item.id)),
              onNone: () => setTrashPicked([]),
            },
              h('button', {
                type: 'button', className: 'dshk-ghost', disabled: trashPicked.length === 0,
                onClick: restorePicked,
              }, t('trash.restore')),
              h('button', {
                type: 'button', className: 'dshk-ghost', 'data-danger': 'true', 'data-armed': 'true',
                disabled: trashPicked.length === 0, onClick: () => purgePicked(false),
              }, t('trash.purge')),
              h('button', {
                type: 'button', className: 'dshk-ghost', 'data-danger': 'true', 'data-armed': 'true',
                onClick: () => purgePicked(true),
              }, trashConfirm === 'all' ? t('trash.purgeConfirm') : t('trash.purgeAll'))),
            h('div', { className: 'dshk-grid' }, trash.map((item) =>
              h(PictureTile, {
                key: item.id, item, selected: trashPicked.includes(item.id),
                onToggle: (id) => toggle(trashPicked, setTrashPicked, id),
                onOpen: setZoom,
              }))))

      return h('div', { className: 'dshk-hist' },
        head,
        historyBody,
        h('div', { className: 'dshk-trashhead' },
          h('h2', null, t('trash.title')),
          h('span', { className: 'sub' }, t('trash.count', { n: trashTotal ?? (trash ?? []).length })),
          h('p', { className: 'path' }, t('history.folder', { p: state?.trashDir ?? '' }))),
        trashBody,
        zoom === null
          ? null
          : h('div', {
              className: 'dshk-zoom', role: 'dialog', 'aria-modal': 'true', 'aria-label': shortOf(zoom.prompt, 60),
              onClick: () => setZoom(null),
            },
              h('img', { src: zoom.src, alt: zoom.prompt }),
              (inTrashList ? trash : items).length > 1
                ? h('button', {
                    type: 'button', className: 'dshk-arrow left', 'aria-label': t('zoom.prev'),
                    onClick: (event) => { event.stopPropagation(); move(inTrashList ? trash : items, zoom, 1) },
                  }, '‹')
                : null,
              (inTrashList ? trash : items).length > 1
                ? h('button', {
                    type: 'button', className: 'dshk-arrow right', 'aria-label': t('zoom.next'),
                    onClick: (event) => { event.stopPropagation(); move(inTrashList ? trash : items, zoom, -1) },
                  }, '›')
                : null,
              h('div', { className: 'dshk-zoombar', onClick: (event) => event.stopPropagation() },
                // Naming the file is what makes a destructive press safe.
                h('span', { title: zoom.name },
                  `${zoom.name ?? ''} · ${whenOf(zoom.at)} · ${String(zoom.size ?? '').replace('x', '×')}`
                  + (inTrashList ? ` · ${t('trash.deletedAt')} ${whenOf(zoom.deletedAt ?? zoom.at)}` : '')),
                inTrashList
                  ? h('button', {
                      type: 'button',
                      onClick: () => post('/trash/restore', { ids: [zoom.id] }).then(() => { setZoom(null); onReload() }).catch(() => {}),
                    }, t('trash.restore'))
                  : h('button', { type: 'button', onClick: () => onReuse(zoom) }, t('history.reuse')),
                h('button', { type: 'button', onClick: () => copy(zoom) }, copied === zoom.id ? t('history.copied') : t('history.copy')),
                // The file path is the one thing that survives the lightbox:
                // it is what the user pastes into Explorer or a chat window.
                h('button', {
                  type: 'button', onClick: copyZoomPath, title: fullPathOf(zoom),
                  'data-tone': zoomCopy === 'failed' || zoomCopy === 'missing' ? 'bad' : undefined,
                }, zoomCopy === 'done'
                  ? t('zoom.pathCopied')
                  : zoomCopy === 'missing'
                    ? t('zoom.pathMissing')
                    : zoomCopy === 'failed'
                      ? t('zoom.pathFailed')
                      : t('zoom.copyPath')),
                onDownload === undefined ? null : h('button', { type: 'button', onClick: () => onDownload(zoom) }, t('zoom.saveAs')),
                h('button', {
                  type: 'button', 'data-danger': 'true',
                  'data-armed': String(inTrashList ? trashConfirm === zoom.id : confirming === zoom.id),
                  onClick: () => {
                    if (inTrashList) {
                      if (trashConfirm !== zoom.id) {
                        setTrashConfirm(zoom.id)
                        window.setTimeout(() => setTrashConfirm(''), 3200)
                        return
                      }
                      setTrashConfirm('')
                      post('/trash/purge', { ids: [zoom.id] }).then(() => { setZoom(null); onReload() }).catch(() => {})
                      return
                    }
                    remove(zoom)
                  },
                }, (inTrashList ? trashConfirm === zoom.id : confirming === zoom.id)
                  ? t('history.confirm')
                  : inTrashList ? t('trash.purge') : t('history.delete')),
                h('button', { type: 'button', onClick: () => setZoom(null) }, t('zoom.close')))))
    }

    /* ------------------------------------------------------------- settings */

    function KeyTab({ state, onRefresh, onReveal }) {
      const [draft, setDraft] = React.useState('')
      const [label, setLabel] = React.useState('')
      const [error, setError] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [editing, setEditing] = React.useState('')
      const [replaceText, setReplaceText] = React.useState('')
      const [removing, setRemoving] = React.useState('')
      const [dir, setDir] = React.useState(state?.outputDir ?? '')
      const [dirNote, setDirNote] = React.useState('')

      React.useEffect(() => { setDir(state?.outputDir ?? '') }, [state?.outputDir])

      /** Returns whether the write landed, so callers clear inputs only on success. */
      const run = async (payload) => {
        setBusy(true)
        setError(null)
        try {
          await post('/key', payload)
          onRefresh()
          return true
        } catch (failure) {
          setError(failure.message)
          return false
        } finally {
          setBusy(false)
        }
      }

      const flash = (text) => {
        setDirNote(text)
        window.setTimeout(() => setDirNote(''), 2400)
      }

      const absolute = (value) => /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\')

      const saveDir = async () => {
        setError(null)
        setDirNote('')
        const wanted = dir.trim()
        if (wanted === '') {
          setError(t('dir.bad'))
          return
        }
        if (!absolute(wanted)) {
          setError(t('dir.bad'))
          return
        }
        try {
          const next = await post('/settings', { outputDir: wanted })
          // Show what actually took effect rather than what was typed.
          if (typeof next?.outputDir === 'string') setDir(next.outputDir)
          flash(t('dir.saved'))
          onRefresh()
        } catch (failure) {
          setError(failure.message)
        }
      }

      const keys = Array.isArray(state?.keys) ? state.keys : []
      const rows = keys.length === 0
        ? h('div', { className: 'dshk-note-block' }, t('key.none'))
        : h('div', { className: 'dshk-keys' }, keys.map((key) => {
            const usage = (state?.quota?.keys ?? []).find((row) => row.id === key.id) ?? {}
            const exhausted = (usage.dayUsed ?? 0) >= (usage.dayLimit ?? 400) || (usage.minuteUsed ?? 0) >= (usage.minuteLimit ?? 2)
            return h('div', {
              key: key.id, className: 'dshk-krow',
              'data-off': String(key.enabled === false),
              'data-bad': String(key.configured === false || exhausted),
            },
              h('div', { className: 'kh' },
                h('span', { className: 'nm' },
                  h('span', { className: 'dot' }),
                  h('b', null, key.label),
                  h('span', { className: 'hint' }, key.hint === '' ? t('key.missing') : key.hint)),
                h('span', { className: 'hint' }, key.enabled === false ? t('key.disabled') : exhausted ? t('key.exhausted') : '')),
              h('div', { className: 'kf' }, t('key.used', { m: usage.minuteUsed ?? 0, d: usage.dayUsed ?? 0 })),
              editing === key.id
                ? h('div', { className: 'dshk-row' },
                    h('input', {
                      className: 'dshk-input', value: replaceText,
                      placeholder: t('key.replacePlaceholder'),
                      onChange: (event) => setReplaceText(event.target.value),
                    }),
                    h('button', {
                      type: 'button', className: 'dshk-ghost', disabled: busy,
                      onClick: async () => {
                        if (await run({ action: 'update', id: key.id, value: replaceText })) {
                          setEditing('')
                          setReplaceText('')
                          flash(t('key.added'))
                        }
                      },
                    }, t('key.keep')),
                    h('button', {
                      type: 'button', className: 'dshk-ghost',
                      onClick: () => { setEditing(''); setReplaceText('') },
                    }, t('key.cancel')))
                : h('div', { className: 'acts' },
                    h('button', {
                      type: 'button', className: 'dshk-ghost',
                      onClick: () => setEditing(key.id),
                    }, t('key.replace')),
                    h('button', {
                      type: 'button', className: 'dshk-ghost',
                      onClick: async () => {
                        if (await run({ action: 'update', id: key.id, enabled: key.enabled === false })) flash(t('key.added'))
                      },
                    }, key.enabled === false ? t('key.enable') : t('key.disable')),
                    // A removed key takes its secret with it, so the second
                    // press is the one that counts.
                    h('button', {
                      type: 'button', className: 'dshk-ghost', 'data-danger': 'true', 'data-armed': 'true',
                      onClick: async () => {
                        if (removing !== key.id) {
                          setRemoving(key.id)
                          window.setTimeout(() => setRemoving((current) => (current === key.id ? '' : current)), 3200)
                          return
                        }
                        setRemoving('')
                        await run({ action: 'remove', id: key.id })
                      },
                    }, removing === key.id ? t('key.confirmRemove') : t('key.remove'))))
          }))

      return h('div', null,
        h('div', { style: { maxWidth: 720, marginTop: 24 } },
          h('h2', { style: { margin: '0 0 10px', fontSize: 15, fontWeight: 600 } }, t('key.title')),
          h('div', { className: 'dshk-note-block' },
            h('div', null, t('key.note')),
            h('div', { style: { marginTop: 8 } },
              h('a', { href: 'https://cloud.siliconflow.cn/account/ak', target: '_blank', rel: 'noreferrer', style: { color: 'inherit' } }, t('key.get')))),
          h('div', { className: 'dshk-card', style: { marginTop: 16 } },
            h('div', { className: 'dshk-add' },
              h('div', { className: 'grow' },
                h('input', {
                  className: 'dshk-input', value: draft, spellCheck: false, autoComplete: 'off',
                  placeholder: t('key.placeholder'),
                  onChange: (event) => setDraft(event.target.value),
                }),
                h('input', {
                  className: 'dshk-input', value: label,
                  placeholder: t('key.labelPlaceholder'),
                  onChange: (event) => setLabel(event.target.value),
                })),
              h('button', {
                type: 'button', className: 'dshk-ghost', 'data-primary': 'true',
                disabled: busy || draft.trim() === '',
                onClick: async () => {
                  // Only a landed write clears the pasted key; a rejected one
                  // leaves the text the user already has on the clipboard side.
                  if (await run({ action: 'add', value: draft, label })) {
                    setDraft('')
                    setLabel('')
                    flash(t('key.added'))
                  }
                },
                style: { height: 32, borderRadius: 8, marginTop: 0 },
              }, t('key.add'))),
            h('p', { className: 'dshk-note' }, t('note.limit')))),
        rows,
        dirNote === '' ? null : h('p', { className: 'dshk-note', 'data-tone': 'ok', style: { maxWidth: 720 } }, dirNote),
        h('div', { style: { maxWidth: 720, marginTop: 28 } },
          h('h2', { style: { margin: '0 0 10px', fontSize: 15, fontWeight: 600 } }, t('dir.title')),
          h('div', { className: 'dshk-card' },
            h('label', { className: 'dshk-note', style: { display: 'block', marginTop: 0, marginBottom: 6 } }, t('dir.label')),
            h('div', { className: 'dshk-row' },
              h('input', {
                className: 'dshk-input', value: dir, spellCheck: false,
                onChange: (event) => { setDir(event.target.value); setDirNote('') },
              }),
              // The native chooser when the composition mounts one; the text
              // field stays the fallback so the control is never a dead end.
              state?.canPickFolder === true
                ? h('button', {
                    type: 'button', className: 'dshk-ghost', disabled: busy,
                    onClick: async () => {
                      setError(null)
                      try {
                        const picked = await post('/pick-folder', {})
                        if (typeof picked === 'string' && picked !== '') setDir(picked)
                      } catch (failure) {
                        setError(failure.message)
                      }
                    },
                    style: { height: 32, borderRadius: 8, flex: 'none' },
                  }, t('dir.browse'))
                : null,
              h('button', {
                type: 'button', className: 'dshk-ghost', 'data-primary': 'true',
                onClick: saveDir, style: { height: 32, borderRadius: 8, flex: 'none' },
              }, t('dir.save'))),
            h('p', { className: 'dshk-note' }, t('dir.note')),
            h('div', { className: 'dshk-row', style: { marginTop: 10 } },
              h('button', {
                type: 'button', className: 'dshk-ghost', onClick: () => onReveal(state?.outputDir),
              }, t('dir.open')))),
          h('div', { className: 'dshk-card', style: { marginTop: 14 } },
            h('h2', null, t('dir.folders')),
            h('p', { className: 'dshk-note', style: { marginTop: 0 } }, t('dir.foldersNote')),
            h('p', { className: 'dshk-pathline' }, `${t('dir.savedFolder')}：${state?.folder ?? ''}`),
            h('p', { className: 'dshk-pathline' }, `${t('dir.trashFolder')}：${state?.trashDir ?? ''}`),
            h('div', { className: 'dshk-row', style: { marginTop: 10, flexWrap: 'wrap' } },
              h('button', { type: 'button', className: 'dshk-ghost', onClick: () => onReveal(state?.folder) }, t('folder.open')),
              h('button', { type: 'button', className: 'dshk-ghost', onClick: () => onReveal(state?.trashDir) }, t('folder.openTrash'))))),
        error === null ? null : h('div', { className: 'dshk-err', style: { maxWidth: 720 } }, error),
        h('p', { className: 'dshk-warn' }, state?.folder === undefined ? '' : t('history.folder', { p: state.folder })))
    }

    /* ---------------------------------------------------------------- page */

    function KolorsPage() {
      useLocale()
      const [tab, setTab] = React.useState('generate')
      const [state, setState] = React.useState(null)
      const [items, setItems] = React.useState([])
      const [historyTotal, setHistoryTotal] = React.useState(undefined)
      const [historyTruncated, setHistoryTruncated] = React.useState(false)
      const [offline, setOffline] = React.useState(false)
      const [days, setDays] = React.useState(null)
      const [windows, setWindows] = React.useState([1, 3, 7, 30, 0])
      const [trashItems, setTrashItems] = React.useState([])
      const [trashTotal, setTrashTotal] = React.useState(0)
      // The unsaved frame and the job that produces it live in STAGE, outside
      // this component tree: switching tabs or panels unmounts bodies, and
      // neither a running request nor the picture it produces may die with them.
      const [notice, setNotice] = React.useState('')
      const [prompt, setPrompt] = React.useState('')
      const [params, setParamsState] = React.useState({ ...DEFAULT_PARAMS })
      // Whether the first paint has adopted either the draft of this session or
      // the Host's restored frame. Until it has, empty defaults are provisional.
      const adopted = React.useRef(false)
      // The boot id of the Host this page is talking to; the draft is stamped
      // with it so a restart is distinguishable from a reload.
      const bootRef = React.useRef('')
      // Once the user moves a control in this session, the stored row must not
      // overwrite the choice on a later refresh; before that, the saved row is
      // what "last used parameters" means.
      const touched = React.useRef(false)
      const setParams = React.useCallback((next) => {
        touched.current = true
        setParamsState(next)
      }, [])

      const loadState = React.useCallback(() => {
        api('/state').then((next) => {
          setState(next)
          setOffline(false)
          if (next?.limits?.windows !== undefined) setWindows(next.limits.windows)
          setDays((current) => (current === null ? next?.limits?.historyDays ?? 7 : current))
          // The Host is the authority on the unsaved frame: it survives a tab
          // switch and a reload, and a new process simply reports none. A frame
          // this page already holds is newer than the one on disk — a running
          // job finishes into STAGE, so it must not be overwritten here.
          const boot = typeof next?.boot === 'string' ? next.boot : ''
          if (STAGE.result === null || (STAGE.boot !== '' && STAGE.boot !== boot)) {
            // A new boot id means the frame in hand names a file the retiring
            // pass already moved to the trash, so it is replaced, not kept.
            stageSet({ result: next?.preview ?? null, boot })
          }
          // Adopt once per page load. The draft is stamped with the boot id it
          // was written under, so "same run, keep typing" and "the app was
          // restarted, start clean" are told apart without a timer.
          if (!adopted.current) {
            adopted.current = true
            bootRef.current = typeof next?.boot === 'string' ? next.boot : ''
            const draft = readDraft()
            const sameRun = typeof draft.boot === 'string' && draft.boot !== '' && draft.boot === bootRef.current
            if (sameRun && typeof draft.prompt === 'string') setPrompt(draft.prompt)
            if (!sameRun) {
              // A restart clears the prompt. The parameters are last-used
              // settings rather than conversation state, so they stay.
              setPrompt('')
              writeDraft({ boot: bootRef.current })
            }
          }
          if (!touched.current && next?.params !== undefined && next.params !== null) {
            setParamsState({
              size: typeof next.params.size === 'string' ? next.params.size : DEFAULT_PARAMS.size,
              steps: Number(next.params.steps ?? DEFAULT_PARAMS.steps) || DEFAULT_PARAMS.steps,
              guidance: Number(next.params.guidance ?? DEFAULT_PARAMS.guidance) || DEFAULT_PARAMS.guidance,
              negative: typeof next.params.negative === 'string' ? next.params.negative : '',
              watermark: next.params.watermark === true,
            })
          }
        }).catch(() => setOffline(true))
      }, [])

      const loadHistory = React.useCallback((window) => {
        const query = typeof window === 'number' ? `?days=${window}` : ''
        api(`/history${query}`).then((next) => {
          setItems(Array.isArray(next.items) ? next.items : [])
          setHistoryTotal(typeof next.total === 'number' ? next.total : undefined)
          setHistoryTruncated(next.truncated === true)
          if (typeof next.days === 'number') setDays((current) => (current === null ? next.days : current))
          if (next.windows !== undefined) setWindows(next.windows)
        }).catch(() => setItems([]))
      }, [])

      const loadTrash = React.useCallback(() => {
        api('/trash').then((next) => {
          setTrashItems(Array.isArray(next.items) ? next.items : [])
          setTrashTotal(typeof next.total === 'number' ? next.total : 0)
        }).catch(() => setTrashItems([]))
      }, [])

      const reloadAll = React.useCallback(() => {
        loadState()
        loadHistory(typeof days === 'number' ? days : undefined)
        loadTrash()
      }, [days, loadState, loadHistory, loadTrash])

      React.useEffect(() => { loadState(); loadTrash() }, [loadState, loadTrash])
      React.useEffect(() => { loadHistory(typeof days === 'number' ? days : undefined) }, [days, loadHistory])

      /**
       * The draft is written here, on the page, and stamped with the boot id of
       * the Host that is running. The next start sees a different id and drops
       * the text on the floor, so closing the app really does clear the prompt.
       */
      React.useEffect(() => {
        if (!adopted.current || bootRef.current === '') return
        writeDraft({ boot: bootRef.current, prompt, params })
      }, [prompt, params])

      // Opening History must reflect pictures a tool call saved meanwhile.
      React.useEffect(() => {
        if (tab === 'history') { loadHistory(typeof days === 'number' ? days : undefined); loadTrash() }
      }, [tab, days, loadHistory, loadTrash])

      // A first visit with an empty pool has nothing to do on this tab.
      const landed = React.useRef(false)
      React.useEffect(() => {
        if (landed.current || state === null) return
        landed.current = true
        const live = Array.isArray(state.keys) ? state.keys.filter((key) => key.enabled !== false && key.configured).length : 0
        if (live === 0) setTab('settings')
      }, [state])

      /**
       * Let the background job reach this page while it is mounted. The job
       * outlives the tab body, so the only way its completion can move the
       * quota meters or refresh the history list is through here — and the
       * callbacks are optional, because a completion that lands while nobody is
       * mounted is normal and must not throw.
       */
      React.useEffect(() => {
        STAGE.hooks.onQuota = (next) => setState((current) => (current === null ? current : { ...current, quota: next }))
        STAGE.hooks.onDone = () => { reloadAll() }
        return () => {
          STAGE.hooks.onQuota = undefined
          STAGE.hooks.onDone = undefined
        }
      }, [reloadAll])

      const reveal = (path) => {
        if (typeof path !== 'string' || path === '') return
        post('/reveal', { path }).then(() => {
          setNotice(t('folder.opened'))
          window.setTimeout(() => setNotice(''), 2200)
        }).catch((failure) => {
          setNotice(failure.message)
          window.setTimeout(() => setNotice(''), 3200)
        })
      }

      /**
       * "Download this" inside a webview. `target="_blank"` is swallowed there,
       * so the picture is handed to the browser as a Blob attachment instead:
       * the same document keeps working, and the file lands where the browser's
       * own downloads go.
       */
      const download = (item) => {
        fetch(item.src)
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return response.blob()
          })
          .then((blob) => {
            const href = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = href
            anchor.download = String(item.name ?? 'kolors.png')
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            window.setTimeout(() => URL.revokeObjectURL(href), 4000)
            setNotice(t('folder.downloaded'))
            window.setTimeout(() => setNotice(''), 2200)
          })
          .catch((failure) => {
            setNotice(String(failure.message ?? failure))
            window.setTimeout(() => setNotice(''), 3200)
          })
      }

      const reuse = (item) => {
        setPrompt(String(item.prompt ?? ''))
        setParams({
          size: typeof item.size === 'string' && item.size !== '' ? item.size : DEFAULT_PARAMS.size,
          steps: Number(item.steps ?? DEFAULT_PARAMS.steps) || DEFAULT_PARAMS.steps,
          guidance: Number(item.guidance ?? DEFAULT_PARAMS.guidance) || DEFAULT_PARAMS.guidance,
          negative: typeof item.negative === 'string' ? item.negative : '',
          watermark: item.watermark === true,
        })
        // The seed is what makes a re-run reproducible; without it "reuse"
        // would quietly produce a different picture. It is written straight into
        // STAGE — the seed box reads from there — so a later tab switch cannot
        // hand back a stale value.
        stageSet({ seed: item.seed === null || item.seed === undefined ? '' : String(item.seed) })
        setTab('generate')
      }

      const quota = state?.quota ?? { minuteLeft: 0, dayLeft: 0 }
      const keyCount = Array.isArray(state?.keys) ? state.keys.filter((key) => key.enabled !== false && key.configured).length : 0

      const head = h('div', { className: 'dshk-head' },
        h('div', null,
          h('h1', null, t('title')),
          h('p', null, t('subtitle')),
          h('div', { className: 'dshk-lock' }, h(LockIcon), t('model.locked'))),
        h('div', { className: 'dshk-meters' },
          state === null
            ? h('span', { className: 'dshk-meter', 'data-off': 'true' }, offline ? t('state.offline') : t('state.reading'))
            : h(React.Fragment, null,
                h(Meter, { label: t('quota.minute', { n: quota.minuteLeft }), low: quota.minuteLeft <= 0 }),
                h(Meter, { label: t('quota.day', { n: quota.dayLeft }), low: quota.dayLeft <= 10 }),
                h('span', { className: 'dshk-meter' }, t('quota.pool', { k: keyCount })))))

      // The page also watches STAGE so the tab strip can show that a job is
      // running — or that a finished frame is waiting on a tab the user is not
      // looking at. Without this the work happens invisibly.
      const stage = useStage()

      const tabs = h('div', { className: 'dshk-tabs', role: 'tablist' }, ['generate', 'history', 'settings'].map((id) =>
        h('button', {
          key: id, type: 'button', className: 'dshk-tab', role: 'tab',
          'aria-selected': String(tab === id),
          'data-on': String(tab === id), onClick: () => setTab(id),
        },
          t(`tab.${id}`),
          id === 'generate' && stage.busy
            ? h('span', { className: 'dshk-ring mini', title: t('browse.detached'), 'aria-label': t('browse.detached') })
            : null,
          id === 'generate' && !stage.busy && stage.unseen
            ? h('span', { className: 'dshk-dot', title: t('tab.unseen'), 'aria-label': t('tab.unseen') })
            : null)))

      let body
      if (tab === 'history') {
        body = h(HistoryTab, {
          items, state, total: historyTotal, truncated: historyTruncated,
          days: typeof days === 'number' ? days : state?.limits?.historyDays ?? 7,
          windows,
          onDaysChange: (value) => {
            setDays(value)
            post('/settings', { historyDays: value }).catch(() => {})
          },
          trash: trashItems, trashTotal,
          onReuse: reuse, onReload: reloadAll, onReveal: reveal, onDownload: download,
        })
      } else if (tab === 'settings') {
        body = h(KeyTab, { state, onRefresh: reloadAll, onReveal: reveal })
      } else {
        body = h(GenerateTab, {
          state, params, setParams, prompt, setPrompt,
          onGoKey: () => setTab('settings'),
          onSaved: () => { reloadAll() },
          onTrashChanged: () => { loadTrash() },
          onDownload: download,
        })
      }

      return h('div', { className: 'dshk-page' },
        h('div', { className: 'dshk-inner' },
          head,
          tabs,
          notice === '' ? null : h('p', { className: 'dshk-note', 'data-tone': 'ok' }, notice),
          body))
    }

    function apply(ctx) {
      ensureStyles()
      if (ctx.locale !== undefined) {
        localeCtx = ctx.locale
        ctx.effect(() => ctx.locale.register(NS, COPY), 'dsh-kolors: dictionaries')
        t = ctx.locale.bind(NS)
      }
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 21,
        label: () => t('panel'),
        locale: NS,
      }, PanelIcon))
      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
      }, KolorsPage))
    }

    exports.name = 'dsh-kolors'
    exports.apply = apply
    exports.inject = ['slots', 'locale']
    return module.exports
  },
})
