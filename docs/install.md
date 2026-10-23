# 安装与运行

## 范围

本篇覆盖：获取主题、安装依赖、首次运行、目录结构、常用命令。前置：Node.js 22.12.0+ 与 npm。

## 准备环境

- Node.js 22.12.0 或更高版本，版本过低时安装依赖会失败；`.nvmrc` 里是建议版本，用 nvm 时 `nvm use` 即可。
- npm 随 Node.js 一起安装，不需要单独准备。
- 首次安装依赖需要联网，之后日常运行可以离线。

## 获取主题

两条路径，任选一条。用模板得到的仓库历史独立，浅克隆只取模板的最新一次提交。

<details>
<summary>用模板建仓库</summary>

在仓库页面选择 **Use this template**，得到一份保留主题代码与示例内容的新仓库。再克隆自己的仓库并进入目录：

```bash
git clone <YOUR-REPO> my-site
cd my-site
```

`<YOUR-REPO>` 换成自己仓库的地址，`my-site` 换成想要的文件夹名。

</details>

<details>
<summary>浅克隆模板仓库</summary>

```bash
git clone --depth 1 --branch main --single-branch \
  https://github.com/planetarium1001/astro-versicarium.git my-site
cd my-site
```

`--depth 1` 只取最新一次提交，`my-site` 换成想要的文件夹名。

托管到自己的仓库时，先删掉模板自带的提交历史与发布工作流，再重新初始化：

```bash
rm -rf .git .github/workflows/release-please.yml .github/workflows/release.yml
git init -b main
git add -A
git commit -m "chore: 初始化站点"
git remote add origin <YOUR-REPO>
git push -u origin main
```

</details>

## 安装依赖与首次运行

- 安装依赖：

  ```bash
  npm install
  ```

  按 `package-lock.json` 解析版本；要严格按锁定版本安装时改用 `npm ci`。

- 启动开发服务器：

  ```bash
  npm run dev
  ```

- 打开 `http://localhost:4321` 查看站点。
- 后台入口是 `http://localhost:4321/admin/`，只在开发环境可写，构建后的线上站点只读。
- 首次启动会顺带生成站点图标，多等几秒。

端口 4321 被占用时换一个端口：

```bash
npm run dev -- --port 4322
```

## 目录结构

只列会用到的层级。

- `content/`：内容
  - `blog/`、`projects/`、`bits/`、`devlog/`、`about/`
  - 一个条目一个目录，主文件是 `index.md`
- `src/`：主题代码与设置
  - `src/data/settings/`：五个设置文件
- `public/`：随站点一起发布的静态资源
  - `images/`、`author/`、`fonts/`
- `docs/`：使用文档、开发文档、Agent 文档与截图

写内容只改 `content/`，改设置只改 `src/data/settings/`，两者都不需要动主题代码。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器与本地后台 |
| `npm run build` | 构建静态产物到 `dist/` |
| `npm run preview` | 预览上一次构建的产物 |
| `npm run verify` | 完整检查：代码、构建、字体、测试与产物 |
| `npm test` | 运行测试用例，不构建 |
| `npm run new:bit` | 生成一条动态草稿 |
| `npm run theme:update` | 同步主题新版本 |
| `npm run font:build` | 按当前内容重新生成字体 |

- `npm run verify` 会更新测试用的页面记录，记录有变化时一起提交。
- 改了页面或样式后跑 `npm run verify`，不要只看构建是否通过。
- `npm run font:build` 需要本机安装 Python 与字体处理工具，只在改动字体时使用，日常开发与构建不需要。

## 首次构建

构建需要站点地址，分享图、订阅源与站点地图都用它：

```bash
SITE_URL=<SITE-URL> npm run build
```

- `<SITE-URL>` 换成站点最终地址，只写域名，不带路径。
- 还没定域名时可以先填一个占位地址，正式发布前再改。
- 站点部署在子目录时再加一项前缀，完整说明见[部署上线](deploy.md)。

构建产物在 `dist/`，可以交给任意静态托管；本地确认效果用 `npm run preview`。
