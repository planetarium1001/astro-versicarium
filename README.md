<h1 align="center">Versicarium · 垄录</h1>

<p align="center">面向开发者的内容与版本管理博客主题，基于 Astro 构建，修改自<a href="https://github.com/cxro/astro-whono">Whono</a>。</p>

<div align="center">
  <p><b>Versicarium</b> = <b><code>versiculus</code></b> + <b><code>arium</code></b></p>
  <p>&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&thinsp;&thinsp;&thinsp;&thinsp;&thinsp;&thinsp;&ensp;诗行短句&emsp;&thinsp;&thinsp;&thinsp;&ensp;收卷之匣</p>
</div>


<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-22C55E?style=flat-square" alt="License: MIT"></a>
  <a href="./CHANGELOG.md"><img src="https://img.shields.io/badge/version-1.0.0--rc.2-F59E0B?style=flat-square" alt="Version 1.0.0-rc.2"></a>
</p>

## 概览

Versicarium 是基于 Astro 的静态站点主题，把技术文章、多版本项目文档、开发日志与短动态整合在同一套内容模型中，并自带一套本地内容管理后台。

- **内容模块**：文章、项目、动态、日志、关于，共五个，支持跨模块归档。
- **运行形态**：开发环境提供完整后台；生产环境只输出静态页面，不保留写入能力。
- **目录分工**：内容写在 `content/`，页面与样式在 `src/`，两者分开存放。

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

需要 Node.js 22.12.0+。

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

模板内包含了 `.github/workflows/{ci.yml, pages.yml}`，可直接修改为自己的配置，并在 GitHub 的仓库启用并配置 Pages。
需要给予 GitHub Action 推送部署 Pages 的权限，否则 Action 构建完无法推送到 Pages。

<details>
  <summary>完整的 ci.yml 和 pages.yml 配置</summary>

- 如果仓库名称为 `<USERNAME>.github.io`，则部署在 `https://<USERNAME>.github.io`。
- 如果仓库名称不为 `<USERNAME>.github.io`，则部署在子路径 `https://<USERNAME>.github.io/<REPO>`
- 将 `ci.yml` 内 `<branch>`（两处）替换为自己的分支名称，一般默认为 `<main>`；并把固定的 `<URL>` 换成自己的部署的站点地址。
- 将 `pages.yml` 内 `<branch>`（两处）替换为自己的分支名称，一般默认为 `<main>`。

<details>
  <summary>ci.yml</summary>

```yml
name: ci

on:
  push:
    branches: [<branch>]
  pull_request:
    branches: [<branch>]

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Resolve Node version
        id: node
        shell: bash
        run: |
          if [ -f .nvmrc ]; then
            version="$(cat .nvmrc)"
          else
            version="$(grep -E '"node"\s*:' package.json | head -n 1 | sed -E 's/.*"node"\s*:\s*"([^"]+)".*/\1/')"
          fi
          if [ -z "$version" ]; then
            version="22"
          fi
          echo "version=$version" >> "$GITHUB_OUTPUT"

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ steps.node.outputs.version }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      # npm run ci 等价于 npm run verify，已包含构建、测试与全部产物守卫。
      # astro.config.mjs 只在 SITE_URL 非空时注册 sitemap 集成，而产物守卫会断言
      # dist/sitemap-*.xml 存在，因此 CI 必须提供它。
      # SITE_URL 只给仓库 owner 的 github.io origin；项目页子路径由构建时的 base 决定。
      - name: Run verification
        run: npm run ci
        env:
          SITE_URL: https://planetarium1001.github.io

      # 根路径 verify 抓不到只在子路径部署出现的重复 base：再以
      # ASTRO_VERSICARIUM_BASE_PATH=/astro-versicarium/ 真实构建一次并扫描 dist。
      - name: Verify subpath build
        run: npm run check:subpath
```
  
</details>
<details>
  <summary>pages.yml</summary>

```yml
name: pages

on:
  push:
    branches: [<branch>]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: <branch>

      - name: Resolve Node version
        id: node
        shell: bash
        run: |
          if [ -f .nvmrc ]; then
            version="$(cat .nvmrc)"
          else
            version="22"
          fi
          echo "version=$version" >> "$GITHUB_OUTPUT"

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ steps.node.outputs.version }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      # 项目页部署在 /<repo>/ 子路径下：站点域名给 owner 的 github.io，子路径交给 base。
      # 示例站仓库是 astro-versicarium，base 动态推导为 /astro-versicarium/。
      # 仓库名若是 <owner>.github.io（用户主页仓库），则部署在根路径。
      # 绑定自定义域名后，把这两项改成固定的域名与 `/`。
      - name: Resolve site URL and base path
        shell: bash
        run: |
          echo "SITE_URL=https://${GITHUB_REPOSITORY_OWNER}.github.io" >> "$GITHUB_ENV"
          repo="${GITHUB_REPOSITORY#*/}"
          owner_lc="$(printf '%s' "${GITHUB_REPOSITORY_OWNER}" | tr '[:upper:]' '[:lower:]')"
          repo_lc="$(printf '%s' "${repo}" | tr '[:upper:]' '[:lower:]')"
          if [ "${repo_lc}" = "${owner_lc}.github.io" ]; then
            echo "ASTRO_VERSICARIUM_BASE_PATH=/" >> "$GITHUB_ENV"
          else
            echo "ASTRO_VERSICARIUM_BASE_PATH=/${repo}/" >> "$GITHUB_ENV"
          fi

      - name: Build
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```
</details>
</details>

### 部署到自己的服务器

使用 `SITE_URL=<YOUR-WEBSITE-URL> npm run build` 构建后将 `dict/` 推送到指定目录后通过配置反向代理完成部署。

<details>
  <summary>示例流程</summary>

```bash
SITE_URL=<YOUR-WEBSITE-URL> npm run build
rsync -rlptD --delete --chmod=D755,F644 dist/ <SERVER-UERNAME>@<SERVER-IP>:<YOUR-SERVER-DIR>
```

</details>

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

常见问题：
- GitHub Pages 与 GitHub Actions 工作流的分支模型、变量推导与常见失败[部署上线 · GitHub Actions 工作流](docs/deployment.md#github-actions-工作流)。
- PV / UV 浏览数据的配置与接入[后台使用 · 浏览数据](docs/admin-console.md#浏览数据)与[站点结构 · 浏览数据](docs/architecture.md#浏览数据)。

更多细节与命令可参考详细文档：
- [站点结构](docs/architecture.md)
- [本地运行与检查](docs/development.md)
- [内容与写作](docs/writing.md)
- [后台使用](docs/admin-console.md)
- [部署上线](docs/deployment.md)
- [版本与发布](docs/release.md)
- [主题更新](docs/upstream.md)
- [站点图标](docs/favicon.md)

## 致谢与许可

- 主题设计起点：[cxro/astro-whono](https://github.com/cxro/astro-whono)。页面布局、后台框架、Markdown 扩展与字体子集等流程与框架均来自该项目。
- 许可：[MIT](LICENSE)。

