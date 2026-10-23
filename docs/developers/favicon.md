# 站点图标

## 范围

本篇覆盖：`site.json` 的 `favicon` 字段解析、生成器输出、渲染回退、后台上传与反向代理放行。前置：仓库能本地运行，设置字段说明见 [主题设置](../settings.md)。

## 配置字段与校验

`site.json` 的 `favicon` 块有三个字段，都以 `/` 开头的 public 路径书写：`svg` 是标签页图标（`.svg`，可选），`png` 是标签页主入口（`.png`），`appleTouchIcon` 是 iOS 主屏图标（`.png`，可选）。

```json
{
  "favicon": {
    "svg": "/favicon.svg",
    "png": "/favicon-32x32.png",
    "appleTouchIcon": "/apple-touch-icon.png"
  }
}
```

`normalizeSiteFaviconPath`（`src/utils/format.ts:171`）负责格式校验：

- 去首尾空白、反斜杠转正斜杠、去掉开头的 `./`；
- 拒绝带协议的 URL、`//` 开头、包含 `..`、`?` 或 `#` 的路径；
- 接受 `/` 或 `public/` 开头的路径并统一成 `/...`，扩展名必须与字段匹配；非法值返回 `undefined`，空串返回 `null`。

`src/lib/theme-settings.ts` 用 `resolveValue` 读取：合法值优先，缺失或非法时回退默认值。合法路径即使文件不存在也会保留，渲染时跳过。

后台保存时，`src/lib/admin-console/theme-shared.ts` 的 `canonicalFaviconSlot` 把非法值原样保留，再由 `validateAdminThemeSettings` 报错，并用 `localFileExists` 检查文件是否存在。

`favicon.source` 只被生成器读取，不在后台表单与设置校验里。

## 关键文件与入口

| 文件或入口 | 作用 |
| --- | --- |
| `src/data/settings/site.json` | `favicon` 字段的配置文件 |
| `src/utils/favicon-defaults.ts` | `DEFAULT_SITE_FAVICON` 与 `GENERATED_SITE_FAVICON` 常量 |
| `src/utils/format.ts` | `normalizeSiteFaviconPath`、`getSiteFaviconLocalFilePath`、`getSiteFaviconSizesFromPath` |
| `src/lib/theme-settings.ts` | favicon 值解析与 `getSiteFaviconLinks`（`:2375`） |
| `src/layouts/BaseLayout.astro` | 渲染 `<link>`，给链接补部署 base |
| `scripts/favicon.mjs` | 生成器，`predev` 与 `prebuild` 自动执行 |
| `src/lib/admin-console/site-assets.ts` | PNG 上传校验、命名与旧文件清理 |
| `src/pages/api/admin/site-assets/upload.ts` | 上传接口，仅开发环境可用 |
| `src/components/admin/AdminSiteSection.astro` | 后台上传控件与尺寸提示文案 |
| `tools/favicon-generated.json` | 生成记录，被 Git 跟踪 |
| `public/images/site/generated/` | 生成结果目录，被 `.gitignore` 忽略 |

## 生成器

`predev`、`prebuild` 执行 `node ./scripts/favicon.mjs`，也可以手动运行。源图按 `favicon.png` → `favicon.source` → `favicon.svg` → `public/favicon-32x32.png` → `public/favicon.svg` 取第一个存在的文件。

路径都按 `public/` 根目录解析；找不到源图时打印 `[favicon] no source image found`，保留现有图标并以成功状态退出。生成用 `sharp`，读取密度 `384`，按 `cover` 缩放到目标尺寸，输出 PNG：

| 文件 | 尺寸或用途 |
| --- | --- |
| `favicon-16x16.png`、`favicon-32x32.png` | 标签页 |
| `apple-touch-icon.png` | 主屏图标，180×180 |
| `icon-192.png`、`icon-512.png` | manifest 图标 |
| `favicon.ico` | 手工拼装 ICO，内含 16、32、48 三个尺寸 |
| `site.webmanifest` | 名称、起始路径、主题色与图标清单 |

`site.webmanifest` 的 `start_url` 与 `scope` 由 `ASTRO_VERSICARIUM_BASE_PATH` 规范化得到，`name` 与 `short_name` 取 `site.json` 的 `title`，`background_color` 为 `#fffefc`，`theme_color` 为 `#b91c1c`。

生成记录写两个文件：`tools/favicon-generated.json`（被跟踪）与 `public/images/site/generated/.favicon-generated.json`，内容是生成文件的存在标记、`rootIco`、`rootIcoHash` 与源图相对路径。

## 根 ICO 写入条件

根目录的 `public/favicon.ico` 只在以下任一情况写入：

- 文件不存在；
- 文件内容与本次生成结果相同；
- 上次生成记录里 `rootIco` 为 `true`，且 `rootIcoHash` 与当前文件哈希一致。

用户替换过且与生成结果不同的 ICO 不会被覆盖；生成记录里的 `rootIcoHash` 总是重新计算当前根文件的哈希。

## 渲染回退

`getSiteFaviconLinks` 先用 `getSiteFaviconLocalFilePath` 把路径映射到 `public/` 并检查存在性，再按顺序组装链接：

1. 有可用的自定义 `svg` 或 `png` 时，标签页图标只输出配置的链接；`svg` 的 `sizes` 固定为 `any`，`png` 的 `sizes` 从文件名里的 `宽x高` 提取。
2. 都没有可用文件时，输出生成目录的 16×16 与 32×32 PNG；两者都不存在时才回退 `public/favicon.svg` 与 `public/favicon-32x32.png`。
3. 生成目录里的 `favicon.ico` 存在时追加 `image/x-icon` 链接；192、512 图标与 `site.webmanifest` 存在时追加 `icon` 与 `manifest` 链接。
4. 主屏图标按 `appleTouchIcon`、标签页 `png`、生成目录的 `apple-touch-icon.png`、`public/apple-touch-icon.png` 顺序取第一个。

`BaseLayout.astro` 用 `withBase` 给每个 `href` 补部署前缀。配置的文件不存在时该字段被忽略，继续往下回退，不会输出裂图。

## 后台上传

上传接口是 `POST /api/admin/site-assets/upload`，生产构建下 `GET` 与 `POST` 都返回 `404`，开发环境 `GET` 返回 `405`。

`src/lib/admin-console/site-assets.ts` 的校验规则：

- 只接受 `png`、`appleTouchIcon` 两个槽位，SVG 必须手动放进 `public/`；
- 文件不超过 256 KB，扩展名 `.png`，MIME 为空、`image/png` 或 `application/octet-stream` 都接受；
- 只解析 PNG 签名与 IHDR 头，宽高偏差超过 `max(2px, 长边 2%)` 拒绝，边长在 16–512px 之间；
- 文件名是 `favicon-<宽>x<高>-<8 位内容哈希>.png` 或 `apple-touch-icon-...`，同内容重复上传得到同一个文件名；
- 清理旧文件时只删匹配该命名规则、且不在当前设置引用列表里的文件。

`src/components/admin/AdminSiteSection.astro` 的提示文案写着同样的边长、体积与命名规则，改限制时要一起改。

## 反向代理

站点前的反向代理、访问控制或挑战页拦截静态图片时，浏览器收到 HTML，标签页显示空图标。放行规则要覆盖实际请求路径，并放在通用拦截规则之前：

```text
^/favicon\.ico$
^/images/site/generated/
^/images/site/
^/apple-touch-icon[^/]*\.png$
```

规则按第一条匹配生效；自定义图标放在 `public/` 其他目录时把对应前缀也加入列表。放行后确认响应类型是 `image/png`、`image/svg+xml` 或 `image/x-icon`：

```bash
curl -sS -o /dev/null -D - https://example.com/images/site/generated/favicon-32x32.png
```

缓存会让修复后的图标不立即更新，用无痕窗口或清理缓存后再验证；`/favicon.ico` 是页面没有图标链接时浏览器隐式请求的路径，放行列表要包含它。

## 常见改动要同时改哪里

| 改动 | 需要同步的位置 |
| --- | --- |
| 新增生成尺寸 | `src/utils/favicon-defaults.ts` 的 `GENERATED_SITE_FAVICON`、`scripts/favicon.mjs` 的生成步骤、`getSiteFaviconLinks` 的链接输出、本页与[主题设置](../settings.md) |
| 修改上传限制 | `src/lib/admin-console/site-assets.ts` 的常量与校验、`AdminSiteSection.astro` 的提示文案、本页 |
| 修改格式校验 | `src/utils/format.ts` 的 `normalizeSiteFaviconPath`、`theme-shared.ts` 的错误文案、本页 |
| 更换默认图标 | `public/` 下的默认文件、`src/utils/favicon-defaults.ts`、本页 |
| 调整回退顺序 | `getSiteFaviconLinks`，同步 `tests/theme-settings.test.ts` 的用例 |
| 图标不显示 | 放行规则与缓存，见[常见问题](../faq.md) |

## 检查与验证

```bash
npm run dev        # predev 先生成图标
ls public/images/site/generated
cat tools/favicon-generated.json
curl -sSI http://localhost:4321/favicon.ico
curl -sSI http://localhost:4321/images/site/generated/favicon-32x32.png
npm test
```

- `tests/theme-settings.test.ts` 覆盖链接回退顺序、缺失文件与默认图标；`tests/admin-site-assets-api.test.ts` 覆盖上传限制、命名与清理。
- 改完生成器后至少跑一次 `npm run build`（会触发 `prebuild`），确认生成目录与生成记录都更新，且根 `public/favicon.ico` 没有被意外覆盖。
