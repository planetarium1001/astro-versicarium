<h1 align="center">Versicarium · 垄录</h1>

<p align="center">面向开发者的内容与版本管理博客主题，基于 Astro 构建，修改自<a href="https://github.com/cxro/astro-whono">Whono</a>。</p>

<div align="center">
  <p><b>Versicarium</b> = <b><code>versiculus</code></b> + <b><code>arium</code></b></p>
  <p>&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&thinsp;&thinsp;&thinsp;&thinsp;&thinsp;&thinsp;&ensp;诗行短句&emsp;&thinsp;&thinsp;&thinsp;&ensp;收卷之匣</p>
</div>


<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-22C55E?style=flat-square" alt="License: MIT"></a>
  <a href="./CHANGELOG.md"><img src="https://img.shields.io/badge/version-0.1.0--rc.1-F59E0B?style=flat-square" alt="Version 0.1.0-rc.1"></a>
</p>

## 概览

Versicarium 是基于 Astro 的静态站点主题，把技术文章、多版本项目文档、开发日志与短动态整合在同一套内容模型中，并自带一套本地内容管理后台。

- **内容模块**：文章、项目、动态、日志、关于，共五个，支持跨模块归档。
- **运行形态**：开发环境提供完整后台；生产环境只输出静态页面，不保留写入能力。
- **目录分工**：内容写在 `content/`，页面与样式在 `src/`，两者分开存放。

## 预览

<table>
  <tr>
    <td width="50%"><img src="docs/images/home-light.webp" alt="首页，亮色，左侧导航与首屏导语"></td>
    <td width="50%"><img src="docs/images/article-light.webp" alt="文章页，右侧目录与浮动按钮"></td>
  </tr>
  <tr>
    <td align="center">首页</td>
    <td align="center">文章</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/images/projects-dialog-light.webp" alt="项目版本弹窗，列出同一项目的全部版本"></td>
    <td width="50%"><img src="docs/images/admin-light.webp" alt="后台主题设置，亮色"></td>
  </tr>
  <tr>
    <td align="center">项目版本</td>
    <td align="center">后台设置</td>
  </tr>
</table>

更多截图在 `docs/images/`。

## 特性

- **布局**：桌面端固定侧栏加内容区；内容区带目录树与浮动操作列，滚动时高亮当前段落并记住阅读位置。
- **主题**：亮色与暗色，可跟随系统或手动切换；切换有过渡动画，同时文章提供专注阅读模式。
- **多版本**：项目与博客系列支持多版本，各自有独立地址；项目在弹窗中切换，文章在侧边抽屉中切换。
- **项目与日志**：项目页用卡片展示，支持图标与封面；日志按项目分目录归档，便于追踪单个项目的变化。
- **动态与关于**：动态支持短文本、图片与作者信息；关于页为独立单页，展示站点信息、友链与常见问题。
- **归档**：文章版本、项目版本与日志共用一条按年月排列的时间线，支持筛选、搜索与标签组合。
- **浏览数据**：可显示 PV / UV，位置与文字前缀可配置；主题只提供槽位，数字由站点接入自己的统计服务。
- **本地后台**：开发环境提供概览、主题、写作、资源与快照五个页面；主题设置涵盖七类，写作页带实时预览与字段检查。
- **资源管理**：统一管理图片与附件，支持上传、批量重命名、移动、删除与整条目 ZIP 导入导出，并显示引用状态，可接入对象存储。
- **中文字体**：字体按用途与常用程度分层，常用字随页面加载，生僻字按需下载。

## 开始使用

需要 Node.js 22.12.0 或更高版本；`.nvmrc` 里的 24.22.1 是建议版本，用 nvm 时直接 `nvm use`。

### 获取主题

<details>
<summary>使用模板</summary>

在仓库页面选择 **Use this template**，得到一个历史独立的仓库，保留主题代码与 `main` 上的示例条目。然后克隆自己的仓库到本地并进入仓库目录。

```bash
npm install
npm run dev
```
启动后访问 `http://localhost:4321`。

</details>

<details>
<summary>手动克隆</summary>

浅克隆只取 `main` 的最新提交，将 `my-site` 修改为自己想要的文件夹名称。
```bash
git clone --depth 1 --branch main --single-branch \
  https://github.com/planetarium1001/astro-versicarium.git my-site
cd my-site
npm install
npm run dev
```

启动后访问 `http://localhost:4321`。

若想将仓库托管在自己的 Git 远程仓库，请删除 `.git` 和 `release` 相关 Actions 并重新初始化：
```bash
rm -rf .git
rm -rf .github/workflows/release-please.yml
rm -rf .github/workflows/release.yml
git init -b main
git add -A
git commit -m "chore: 初始化站点"
git remote add origin <YOUR-REPO>
git push -u origin main
```

</details>


### 快速开始

```bash
npm install
npm run dev
```

启动依据终端内打印的日志访问页面，默认为 `http://localhost:4321`。

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器与本地后台 |
| `npm run build` | 构建静态产物到 `dist/` |
| `npm run preview` | 预览构建产物 |
| `npm run verify` | 完整检查 |
| `npm test` | 运行测试用例 |
| `npm run new:bit` | 生成一条动态草稿 |
| `npm run theme:update` | 按文件同步主题更新 |
| `npm run font:build` | 按当前内容重新生成字体 |

## 部署

### 部署到 GitHub Pages

仓库自带 `.github/workflows/pages.yml`，改三处就能用：

- `on.push.branches` 换成自己的发布分支，一般是 `main`。
- `env.SITE_URL` 换成站点地址，只写协议与域名，不带路径。
- `env.ASTRO_VERSICARIUM_BASE_PATH` 部署在子目录时写 `/<REPO>/`，部署在根目录时写 `/`。

然后在仓库 Settings → Pages 把 Source 设为 **GitHub Actions**，并向发布分支推送，或在 Actions 页面手动运行 `pages` 工作流。

<details>
<summary>pages.yml 的核心结构</summary>

```yaml
on:
  push:
    branches: [<BRANCH>]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

env:
  SITE_URL: <SITE-URL>
  ASTRO_VERSICARIUM_BASE_PATH: /<REPO>/

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: node ./scripts/check-deployment-base.mjs
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`${{ ... }}` 是工作流语法，原样保留。

</details>

完整模板、地址规则、注意事项与常见失败见[部署上线 · GitHub Pages](docs/deploy.md#github-pages)。

`ci.yml` 不用改结构，只把顶部的 `SITE_URL` 换成自己的站点地址。它负责推送与 PR 的完整校验，不部署。

`release-please.yml` 与 `release.yml` 只服务主题发版，都是手动触发，自己的站点不需要保留。

### 部署到自己的服务器

站点是纯静态文件，服务器只需要按目录提供网页，不需要 Node.js、数据库或后台进程。

1. 构建：`SITE_URL=<SITE-URL> npm run build`，产物在 `dist/`。
2. 上传：把 `dist/` 里的内容放到服务器站点目录，源码、`node_modules/` 与本地缓存不要上传。
3. 配置：Nginx 的 `root` 指向站点目录，`index` 设为 `index.html`。站点按目录生成页面，文章地址对应目录里的 `index.html`，不需要额外重写规则。
4. 启用 HTTPS：把 `SITE_URL` 改成 `https://` 开头并重新构建，页面里的绝对链接、订阅地址与分享图才会用新地址。

<details>
<summary>rsync 上传</summary>

```bash
SITE_URL=<SITE-URL> npm run build
rsync -rlptD --delete --chmod=D755,F644 dist/ <SERVER-USER>@<SERVER-HOST>:<SERVER-DIR>/
```

- `<SITE-URL>` 换成站点地址，只写协议与域名。
- `<SERVER-USER>`、`<SERVER-HOST>`、`<SERVER-DIR>` 换成服务器账号、地址与站点目录。
- `--delete` 会删除目标目录里多余的文件；第一次上传前确认目标目录只放站点文件。

</details>

<details>
<summary>Nginx 站点配置</summary>

```nginx
server {
  listen 80;
  server_name <HOST-NAME>;
  root <SERVER-DIR>;
  index index.html;

  location /_astro/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location /fonts/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
}
```

- `<HOST-NAME>` 换成域名，`<SERVER-DIR>` 换成站点目录的绝对路径。
- `/_astro/` 与 `/fonts/` 下的文件名带内容哈希，可以长期缓存；这两个 location 只加缓存头，不改路由。
- 改完先跑 `nginx -t` 检查，再重新加载 Nginx。
- 站点放在子目录时，把 `root` 指向子目录，或单独加一个 `location /<SUBDIR>/`。

</details>

发布后复查：

- 打开首页，确认样式、图片与字体都正常加载。
- 打开一篇文章，确认正文与分享图正常；分享图地址来自 `SITE_URL`。
- 抽查站内链接、分页与归档，确认没有指向旧域名或站点根目录。
- 子目录部署时，确认访问地址带子目录前缀。

遇到问题时：

- 图标不显示：反向代理或人机验证可能拦住了图标请求，见[反向代理拦截图标](docs/faq.md#反向代理拦截图标)。
- 页面能打开但样式丢失：多半是子目录前缀没设对，见[页面能打开但样式丢失](docs/faq.md#页面能打开但样式丢失)。
- 改了内容但线上没变：浏览器或 CDN 缓存，见[浏览器缓存](docs/faq.md#浏览器缓存)。
- 换了字体没生效：见[换了字体没生效](docs/faq.md#换了字体没生效)。
- 构建或检查失败：见[构建失败](docs/faq.md#构建失败)与 [verify 失败](docs/faq.md#verify-失败)。

完整步骤、缓存配置与复查清单见[部署上线 · 自建服务器](docs/deploy.md#自建服务器)。

## 主题命名由来

<details>
<summary> 由 DeepSeek 总结攥写 </summary>
</br>

> 名字 **Versicarium** 的深处，藏着一条关于“书写”的古老线索。
> 
> 在拉丁语中，这一切都源于动词 **`vertere`**（转动、翻转）。古人采用牛耕式的书写技术，写到行尾必须将手“转”回行首。正是一次次不停地“转”，刻下了具体的痕迹 **`versus`**——它既是翻开的“犁沟”，也是落下的“诗行”；同时，这种动作的不断重复与交替，孕育了宏观的演进 **`version`**，即我们今天所说的“版本”。连接这两个维度的，是微观的刻度 **`versiculus`**。作为 `versus` 的指小形式，它代表了每一次“转动”所切分出的最小物理单元。在中世纪圣咏中，它化身为主导与应答（℣ / ℟）的对话结构——它不以长篇宏论为目标，而是作为等待被回应的最小记录单元。正因为有无数个 `versiculus`（短行）在 `vertere`（转动）中积累，才最终堆叠出了 `version`（版本）的演进。将这样的短行收拢，便构成了 **`-arium`** 的意义：它不是抽象的容器，而是实际收存的物理空间。**Versicarium** 便是那个把代码行与版本记录归档的实体。  
> 
> 中文名 **“垄录”** 精准对应了这一动作意象。在古典中文语境里，“垄”不仅指田埂，更直接指向“垄亩”（耕作）与“笔耕”（书写）。**垄**是敲下的代码与诗行，**录**是见证每一次翻转与迭代的归档。  
> 中西方的隐喻在此交汇，最终落于一句话：  
> **一行一垄，一版一录。**

</details>

## 文档

使用文档，按阅读顺序：

- [安装与运行](docs/install.md)
- [内容与写作](docs/content.md)
- [主题设置](docs/settings.md)
- [后台使用](docs/admin.md)
- [部署上线](docs/deploy.md)
- [主题更新](docs/update.md)
- [常见问题](docs/faq.md)

其他：

- [使用文档索引](docs/README.md)
- [开发文档](docs/developers/)：改主题代码、维护仓库、发布版本
- [Agent 文档](docs/agents/)：本地 LLM 与 Agent 的仓库地图、事实台账与改动入口，用于辅助站点的快速搭建。

常见问题直达：

- GitHub Pages 与 GitHub Actions 的分支改法与常见失败：[部署上线](docs/deploy.md)
- PV / UV 浏览数据的配置与接入：[主题设置](docs/settings.md)
- 图标不生效、反向代理拦截图标：[常见问题](docs/faq.md)

## 致谢与许可

- 主题设计起点：[cxro/astro-whono](https://github.com/cxro/astro-whono)。页面布局、后台框架、Markdown 扩展与字体子集等流程与框架均来自该项目。
- 许可：[MIT](LICENSE)。
