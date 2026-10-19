# 站点图标

## 槽位

站点图标由 `src/data/settings/site.json` 的 `favicon` 块控制：

```json
"favicon": {
  "svg": null,
  "png": null,
  "appleTouchIcon": null
}
```

| 槽位 | 用途 | 格式 | 来源 |
| --- | --- | --- | --- |
| `svg` | 标签页图标，可选 | `.svg` | 手动放入 `public/` 后写路径 |
| `png` | 标签页图标，主入口 | `.png` | 后台上传，或手动放入 `public/` |
| `appleTouchIcon` | iOS 主屏图标，可选 | `.png` | 后台上传，或手动放入 `public/` |

路径必须是 `public/` 下的文件，可以写 `/images/site/favicon-32x32.png`，也可以写 `public/images/site/favicon-32x32.png`。不接受远程 URL、`..`、`?`、`#`，扩展名必须与槽位匹配。渲染时链接会补上部署 `base`。

后台只提供 PNG 上传。SVG 不提供上传，需要手动放到 `public/`，再在 `site.json` 中填写。完整主题字段见 [admin-console.md](admin-console.md)。

## 生成

`predev` 与 `prebuild` 都会执行 `node ./scripts/favicon.mjs`，也可以手动运行。生成器按以下顺序选择源图：

1. `site.json` 的 `favicon.png`；
2. `favicon.svg`；
3. 默认的 `public/favicon-32x32.png`；
4. 默认的 `public/favicon.svg`。

输出写入 `public/images/site/generated/`：

| 文件 | 用途 |
| --- | --- |
| `favicon-16x16.png`、`favicon-32x32.png` | 标签页 |
| `apple-touch-icon.png` | 主屏图标兜底，180×180 |
| `icon-192.png`、`icon-512.png` | Web App Manifest 图标 |
| `favicon.ico` | 旧浏览器与隐式 `/favicon.ico` 请求 |
| `site.webmanifest` | 名称、起始路径、主题色与图标清单 |

根目录的 `public/favicon.ico` 只在文件缺失、内容与本次生成一致，或确认仍是上次生成结果时写入；用户替换过的 ICO 不会被覆盖。生成标记写入 `tools/favicon-generated.json` 与 `public/images/site/generated/.favicon-generated.json`。

生成目录属于主题运行时资产，不要手改。需要更换图标时修改槽位或替换源图，再重新运行生成器。

## 回退顺序

标签页图标：

1. 配置了 `svg` 或 `png` 时，只输出配置的自定义标签页链接；
2. 两者都为空时，若生成目录存在 16×16、32×32 PNG，输出对应链接；
3. 生成文件也不存在时，回退 `public/favicon.svg` 与 `public/favicon-32x32.png`，只输出实际存在的文件；
4. 生成目录存在 ICO、192、512 或 manifest 时，追加对应链接。

主屏图标：

1. 配置了 `appleTouchIcon` 时使用该文件；
2. 留空时复用标签页 `png`，复用链接不写 `sizes`；
3. 再回退生成的 `apple-touch-icon.png`；
4. 没有自定义标签页图标时，最后回退默认 `public/apple-touch-icon.png`。

配置路径指向的文件不存在时，渲染层忽略该槽位并继续回退，不会输出裂图。只配置 SVG、没有 PNG 时，主屏图标不会直接复用 SVG；生成器会从 SVG 生成 `apple-touch-icon.png` 作为兜底，需要专用主屏图时再单独设置。

## 本地验证

```bash
npm run dev
curl -sSI http://localhost:4321/favicon.ico
curl -sSI http://localhost:4321/images/site/generated/favicon-32x32.png
```

子路径部署时把 `ASTRO_WHONO_BASE_PATH` 也加到 URL 前缀。修改 `site.json` 后重启开发服务器，确认 `<link rel="icon">`、`apple-touch-icon` 与 manifest 指向预期文件。

## 反向代理

站点前的反向代理、访问控制或挑战层如果拦截静态图片，浏览器会收到 HTML 而不是图片，标签页显示空图标。放行规则应覆盖实际请求路径，并放在通用拦截规则之前：

```text
^/favicon\.ico$
^/images/site/generated/
^/images/site/
^/apple-touch-icon[^/]*\.png$
```

规则按第一条匹配生效。若自定义图标放在 `public/` 的其他目录，也要把对应前缀加入放行列表。放行后确认响应类型为 `image/png`、`image/svg+xml` 或 `image/x-icon`，而不是 `text/html`。

```bash
curl -sS -o /dev/null -D - https://example.com/images/site/generated/favicon-32x32.png
```

缓存可能让修复后的图标仍不更新；用无痕窗口或清理 favicon 缓存后再验证。`/favicon.ico` 是页面没有 icon 链接时浏览器隐式请求的路径，不能替代显式链接的放行。
