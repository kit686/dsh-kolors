# 发布清单

第一次发布按顺序走一遍。每一步都标了「改什么」和「怎么验证」。

> 这份文档按 2026-11-26 的实际发布过程写成。npm 的政策在变，下面的时间点会过期，遇到报错先看「常见拦截」那一节。

## 0. 仓库地址

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
git init -b main
git add -A
git commit -m "dsh-kolors 0.1.0"
git remote add origin https://github.com/kit686/dsh-kolors.git
git push -u origin main
```

> `node_modules` 和 `*.tgz` 不该进仓库。第一次 `git add` 前先确认一遍 `git status`，看到 `node_modules/` 就说明缺 `.gitignore`。

仓库要在 GitHub 上先建一个**空的**（不要勾 README / .gitignore / license），否则远端会有一个和本地无关的初始提交，`git push` 直接被拒。

### 邮箱必须换成 noreply

GitHub 默认开启「Block command line pushes that expose my email」。用真实邮箱提交会被拒：

```
remote: error: GH007: Your push would publish a private email address.
```

按仓库改（不想动全局就这么做）：

```powershell
git config user.email "298617303+kit686@users.noreply.github.com"
git commit --amend --reset-author --no-edit
git push -u origin main
```

前面的数字是 GitHub 账号的永久 ID，用户名再改也不会失效。想一劳永逸就加 `--global`。

## 2. 确认包名还没被占

```powershell
npm view dsh-kolors version --registry=https://registry.npmjs.org/
```

404 说明这个名字是空的。

如果哪天被人占了，`package.json` 里的 `name` 要改成带作用域的，比如 `@你的名字/dsh-kolors`，发布时加 `--access public`。

## 3. 这台机器的 registry 陷阱

用户级 `.npmrc`（`C:\Users\35902\.npmrc`）里写着淘宝镜像：

```
registry=http://registry.npmmirror.com/
```

镜像只读，**发布相关命令一律显式加 `--registry=https://registry.npmjs.org/`**，不加就会打到镜像上。

登录镜像时还会看到老式的 `Username: / Password:` 提示——只要它问你要密码，就说明源配错了，npm 官方源走的是浏览器授权。

## 4. 账号 2FA

npm 从 2026 年 9 月起**关闭了新 TOTP 的配置**，「Authenticator app」这个选项已经消失，只剩 Security key（WebAuthn）。

Windows Hello 的 PIN / 指纹 / 人脸就算合格的安全密钥，不需要买 YubiKey。

```
https://www.npmjs.com/settings/kit686/tfa
```

开完在管理页确认这两项：

- `Require two-factor authentication for write actions` 已勾选 —— 发布的前提
- Recovery Codes 已经下载保存 —— 只有一次展示机会，是唯一的备用登录通道

## 5. 发布用令牌

CLI 的 `npm publish` 会要 6 位动态码，而安全密钥给不出数字，所以本机发布走**绕过 2FA 的细粒度令牌**：

```
https://www.npmjs.com/settings/kit686/tokens → Generate New Token → Granular Access Token
```

| 字段 | 值 |
|---|---|
| Permissions | `Read and write (publish and stage)` |
| Packages | All packages（新包名还没创建，选不了具体包） |
| Organizations | `No access`（不选会报 "must select at least one organization"） |
| Bypass two-factor authentication | ✅ 必勾 |
| Expiration | 30 days |

令牌写进 npm 的 **userconfig**。注意这台机器被 Cadence 把 `HOME` 指到了 `D:\Cadence\SPB_Data`，所以真正的 userconfig 不是 `C:\Users\35902\.npmrc`：

```powershell
$t = (Get-Clipboard).Trim()
$f = "D:\Cadence\SPB_Data\.npmrc"
$lines = @(Get-Content $f -ErrorAction SilentlyContinue | Where-Object { $_ -notmatch '^//registry\.npmjs\.org/:_authToken=' })
$lines += "//registry.npmjs.org/:_authToken=$t"
Set-Content -Path $f -Value $lines
```

**发布完立刻回 tokens 页面删掉这个令牌。** 它带绕过 2FA 的发布权，等同于账号密码。

## 6. 自检

```powershell
npm run check          # 155 项离线检查
npm pack --dry-run     # 看会打包哪些文件
```

`npm pack --dry-run` 应该恰好列出 12 个文件：`LICENSE`、`README.md`、`client.js`、`cordis.patch.yml`、`docs/DETAIL.md`、`docs/DETAIL.zh.md`、`docs/preview.svg`、`icon.svg`、`index.js`、`locale/en.json`、`locale/zh.json`、`package.json`。

多出来的东西要么是忘了进 `files`，要么是不该发的。末尾那个 `shasum` 记下来，发布后要拿它比对。

## 7. 发布

```powershell
npm publish --registry=https://registry.npmjs.org/
```

### 新包名首发会被暂存

首次发布一个没人用过的包名，npm 不会直接上线：

1. 建一个 `0.0.0-stage` 占位符（2 个文件、332 字节），`latest` 先指向它
2. 真正的版本进暂存队列
3. 等维护者批准

批准入口：`https://www.npmjs.com/settings/kit686/staged`（左栏 "Staged Packages"）。

**队列是空的也不代表没发出去。** 2026-11-26 那次 0.1.0 是开完 2FA 后自动放行的，网页和 `npm stage list` 都显示空队列，但版本已经在线上。以 `npm view` 为准。

同版本号重发会报：

```
409 Conflict - Cannot publish over previously staged version "0.1.0".
```

这句话反而是好消息，说明东西确实在队列里，只是还没放行。

## 8. 验证线上产物

```powershell
npm view dsh-kolors --registry=https://registry.npmjs.org/
```

对比 `dist.shasum` 和第 6 步记下的那个，一致才算发对了。

想更彻底就下载线上 tarball 逐文件比对 SHA256：

```powershell
npm pack dsh-kolors@0.1.0 --registry=https://registry.npmjs.org/
```

再开一个新 DSH 会话，Plugins → Add plugin 填 `dsh-kolors@0.1.0`，确认侧栏出现「Kolors生图」、图标和详情页正常、能出图。

注意：装了 npm 版之后，本地 `link:` 指向的开发目录就失效了，改代码不会再生效。

## 9. 发新版本

```powershell
npm version patch    # 0.1.0 -> 0.1.1；修 bug 用 patch
npm version minor    # 加功能用 minor
npm publish --registry=https://registry.npmjs.org/
```

- 同版本号永远发不出去，只能升号
- 已有包的新版本目前还能用绕过令牌直发
- **2027 年 1 月起**，绕过 2FA 的令牌失去直发权，只能暂存后到网页用安全密钥批准

`engines.dsh` 写了 `>=0.2.2-rc.1`，意思是 DSH 版本低于这个的装不上。以后 DSH 大改、插件要跟着改的时候，这个范围也要一起调。

## 常见拦截速查

| 报错 | 原因 | 处理 |
|---|---|---|
| `GH007` | 提交里带真实邮箱 | 换 noreply 地址，`git commit --amend --reset-author` |
| `ENEEDAUTH` | 没登录，或登录写进了别的 npmrc | 查 `npm config get userconfig` |
| `E403 ... Two-factor authentication or granular access token` | 账号没 2FA，或用的是普通令牌 | 开 2FA + 建带 bypass 的 GAT |
| `E409 ... previously staged version` | 该版本已在暂存队列 | 去 Staged Packages 批准，等自动放行 |
| `duplicate key value violates unique constraint "users_name_idx"` | 用户名已被占用 | 注册页实时提示会告诉你哪个能用 |
| 登录时问 `Password:` | 连的是淘宝镜像 | 加 `--registry=https://registry.npmjs.org/` |

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
