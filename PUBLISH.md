# 发布清单

第一次发布按顺序走一遍。每一步都标了「改什么」和「怎么验证」。

## 0. 先替换占位符

`package.json` 里三处仓库地址已经填成 `kit686`：

```json
"repository": { "type": "git", "url": "git+https://github.com/kit686/dsh-kolors.git" },
"homepage": "https://github.com/kit686/dsh-kolors#readme",
"bugs": { "url": "https://github.com/kit686/dsh-kolors/issues" }
```

换成别的账号时，这三处要跟着改。没填的话 npm 也能发出去，但包页面上「仓库」那一栏会缺，别人没法给你提 issue。

## 1. 建 Git 仓库

```powershell
cd D:\agent项目\dsh-kolors
git init
git add -A
git commit -m "dsh-kolors 0.1.0"
```

> `node_modules` 和 `*.tgz` 不该进仓库。第一次 `git add` 前先确认一遍 `git status`，看到 `node_modules/` 就说明缺 `.gitignore`。

推到 GitHub，仓库名建议就叫 `dsh-kolors`，公开。

## 2. 确认包名还没被占

```powershell
npm view dsh-kolors version
```

现在是 404，说明 `dsh-kolors` 这个名字是空的，可以直接用。
如果哪天被人占了，`package.json` 里的 `name` 要改成带作用域的，比如 `@你的名字/dsh-kolors`，并在发布时加 `--access public`。

## 3. 登录 npm

```powershell
npm login
```

浏览器会开一个授权页，登完回车。验证：

```powershell
npm whoami
```

## 4. 发布前最后自检

```powershell
npm run check          # 155 项离线检查
npm pack --dry-run     # 看会打包哪些文件
```

`npm pack --dry-run` 应该恰好列出 12 个文件：`LICENSE`、`README.md`、`client.js`、`cordis.patch.yml`、`docs/DETAIL.md`、`docs/DETAIL.zh.md`、`docs/preview.svg`、`icon.svg`、`index.js`、`locale/en.json`、`locale/zh.json`、`package.json`。

多出来的东西要么是忘了进 `files`，要么是不该发的。

## 5. 发布

```powershell
npm publish
```

几秒后就能在 `https://www.npmjs.com/package/dsh-kolors` 看到。

## 6. 用真实安装验证

发布成功不等于能装能跑。开一个新的 DSH 会话，在 Web 侧栏「Plugins」→「Add plugin」里填：

```
dsh-kolors@0.1.0
```

装完确认三件事：

1. 左侧栏出现「Kolors生图」入口
2. Plugins 里这一条的图标、标题、说明、详情页的示意图都正常
3. 点进去能出图

装完发现问题不能改已发布的版本：npm 不允许覆盖同一个版本号。修完把 `version` 改成 `0.1.1` 再发。

## 7. 发新版本

```powershell
npm version patch    # 0.1.0 -> 0.1.1；修 bug 用 patch
npm version minor    # 加功能用 minor
npm publish
```

`engines.dsh` 写了 `>=0.2.2-rc.1`，意思是 DSH 版本低于这个的装不上。以后 DSH 大改、插件要跟着改的时候，这个范围也要一起调。

## 关于「插件市场」

DSH 目前**没有官方市场索引**。Discover 页只列用户自己填的索引地址。

想让别人在 Discover 里搜到你，得自己托管一个索引 JSON（放 GitHub Pages 就行），格式是：

```json
{
  "format": 1,
  "title": { "en": "My plugins", "zh": "我的插件" },
  "plugins": [
    {
      "name": "dsh-kolors",
      "title": { "en": "Kolors Image", "zh": "Kolors生图" },
      "description": { "en": "...", "zh": "..." },
      "author": "你的名字",
      "repository": { "url": "https://github.com/kit686/dsh-kolors" },
      "metadata": { "keywords": ["kolors", "image"] },
      "versions": [
        {
          "version": "0.1.0",
          "publishTimestamp": 1795699000,
          "source": { "type": "npm" },
          "engines": { "dsh": ">=0.2.2-rc.1" }
        }
      ]
    }
  ]
}
```

`publishTimestamp` 是 Unix 秒。别人在 Discover 的「Index sources」里填你这个 JSON 的地址就能看到。

这一步不是必须的。只发到 npm 也完全能用，只是别人得自己知道包名。
