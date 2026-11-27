# dsh-kolors

[English](README.en.md)

免费生图，装在 DeepSeek Harness 侧栏里。直接用硅基流动免费的 `Kwai-Kolors/Kolors`，不收费、不加水印、不绑模型选择。

完全免费：Kolors 本身不收费，插件也不收任何费用。唯一要求是硅基流动账户余额 ≥ 0（平台门槛，不是付费）。

![生图页](docs/screenshot-1.png)

## 安装

```bash
dsh plugin add dsh-kolors
```

不想走 npm 也可以直接从 GitHub 装（需要本机能 `git clone`）：

```bash
dsh plugin add github:kit686/dsh-kolors#v0.3.0
```

两种装法拿到的是同一份代码。也可以直接写进 profile 的依赖，或在 DSH 的 **Plugins → Add plugin** 里粘贴包名。模型固定为 `Kwai-Kolors/Kolors`，没有模型选择项。

装好后左侧栏会出现「Kolors生图」，第一次打开先到**设置页**粘一个[硅基流动](https://cloud.siliconflow.cn/)的 API Key。

## 功能

- **生图页**：提示词、可调参数（5 档尺寸带比例示意、步数、贴合度、反向提示词、种子、水印开关）、浏览窗口（保存 / 下载 / 删除 / 放大）。
- **历史页**：1 / 3 / 7 / 30 天 / 全部筛选，多选与批量删除，放大、翻页、复用参数、下载、复制路径，外加回收站（恢复 / 彻底删除 / 清空）。
- **设置页**：Key 池（多 Key 轮换，单 Key 也能用）、图片保存目录（手填或系统选择器）、两个目录的一键打开。

没保存的图只活在这一页：切标签、切到别的侧栏页面、刷新页面都还在，彻底关掉 DSH 后清空。
出图途中切走不用守着——请求在后台跑完，切回来就能看到；标签上会有小圆点提示新图已出好。

额度：每 Key 每分钟 2 张、每天 400 张，本机先挡一道，计数写盘、重启不清零。

同时注册 `kolors_image` 工具，让模型在对话里直接出图，走同一套额度和同一个保存文件夹。

## 本机文件

| 文件 | 用途 |
|---|---|
| `~/.dsh/secrets/kolors.env` | API Key（权限 600） |
| `~/.dsh/dsh-kolors.json` | 输出目录、上次参数、Key 元数据、用量、当前浏览窗口里的那张图 |
| `~/.dsh/kolors-frames/` | 浏览窗口那张图的本体，界面从不指路，重启时清空 |
| `<输出目录>/dsh-kolors-image/` | 保存的图 + `index.json` |
| `<输出目录>/dsh-kolors-image/dsh-kolors-trash/` | 回收站 + `index.json`，上限 2000 张，超出时最旧的连文件一起删 |

没设过输出目录时落在 `~/Pictures`（存在的话），否则落在用户主目录。

## 限制

- Kolors 免费，但平台要求账户余额 ≥ 0，余额见底返回 402。
- 上游图片地址只活 1 小时，所以生成后立刻下载到本机。
- 尺寸只有 `1024x1024`、`960x1280`、`768x1024`、`720x1440`、`720x1280`。
- 推理步数上限 50（上游 `code 20015`），提示词上限 4000 字，反向提示词上限 2000 字。
- 内嵌 webview 会拦掉 `target="_blank"`，用「下载这张」或「复制文件路径」代替新标签页。

## 开发

```bash
git clone https://github.com/kit686/dsh-kolors.git
cd dsh-kolors
dsh plugin add ./dsh-kolors          # 或者用 link: 指向本地目录
```

改 `client.js` 刷新页面即可；改 `index.js`（Host 侧）需要重启 DSH。

## 自检

CI 会跑 `npm run check`，四套离线测试合起来 200+ 条断言，不需要网络也不需要装依赖。

| 命令 | 作用 |
|---|---|
| `npm run check` | 全部离线检查：语法 + selftest + clientaudit + tabswitch + pathcheck |
| `node scripts/selftest.mjs` | Host 侧离线：Key 池、额度窗口、保存/历史/回收站/恢复/清空、换页保持、重启清空、越权路径、插件装配、请求体解码、回收站上限、图片流与 304 |
| `node scripts/clientaudit.mjs` | 浏览器侧静态：模块形状、标识符、中英字典对齐、主题令牌、hook 依赖、复制路径分支、后台任务归属 |
| `node scripts/tabswitch.mjs` | 真跑 `client.js`：起一个小 React 运行时，装页面、点生成、切走、让请求落地、切回来 |
| `node scripts/tabswitch-old.mjs` | 把上面那套跑在上一版 `client.js` 上，证明它确实能抓到这个 bug |
| `node scripts/pathcheck.mjs` | 真跑 `fullPathOf`：生图页 / 历史页 / 回收站三种记录形状都要拿到绝对路径 |
| `node scripts/toolschema.mjs` | 用真实 `dsh-tools` 校验 `kolors_image` 的出入参 schema（需 Harness 在跑） |
| `node scripts/livecheck.mjs` | 打到运行中的插件：保存、历史、回收站、恢复、清空、图片流、越权（需 Harness 在跑） |

## License

MIT
