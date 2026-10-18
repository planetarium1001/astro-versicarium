# 站点图标

站点图标由 `src/data/settings/site.json` 的 `favicon` 块控制：

```json
"favicon": {
  "svg": null,
  "png": "/images/site/favicon-256x256-a1b2c3d4.png",
  "appleTouchIcon": null
}
```

| 槽位 | 用途 | 格式 |
| --- | --- | --- |
| `svg` | 标签页图标（可选） | `.svg` |
| `png` | 标签页图标（主入口） | `.png` |
| `appleTouchIcon` | iOS 主屏图标（可选） | `.png` |

## 单图复用

- `svg` 与 `png` 是独立的标签页槽位，不要求同时设置。只设置 `png` 时只输出 PNG 链接，不会补默认 SVG。
- 后台只提供 PNG 上传。SVG 需手动放到 `public/`，再在 `site.json` 的 `favicon.svg` 写路径。
- `appleTouchIcon` 留空时复用标签页 PNG，复用链接不写 `sizes`；通常只上传一张 256×256 PNG 即可。
- 只有 SVG、没有 PNG 时，没有可复用的触摸图，渲染层不会回退主题默认触摸图标；需要主屏图标时单独设置 `appleTouchIcon`。
- `svg`、`png` 都为空时，才回退 `public/` 下的默认 `favicon.svg`、`favicon-32x32.png`、`apple-touch-icon.png`。默认链接只输出文件实际存在的项。
- `apple-touch-icon` 在 iOS 上只支持 PNG；当前标签页槽位也只接受 PNG。

后台预览在触摸槽位为空且标签页 PNG 存在时显示复用状态；清除触摸图标不会删除标签页 PNG。

## 反向代理下的图标请求

站点前面有 Anubis 或其他挑战层时，favicon 图片请求可能返回挑战页 HTML，而不是图片。浏览器解码失败后标签页显示空图标；子页面可能因请求时机或缓存不同而正常。

Anubis 默认策略只放行 `^/favicon\.(ico|png|gif|jpg|jpeg|svg)$`，不会放行 `/favicon-32x32.png`、`/images/site/favicon-*.png` 等路径。需要把这些路径加入 `ALLOW`，并放在默认的 `generic-browser` 之前；Anubis 规则是第一条匹配即生效。

自定义 policy 文件：

```yaml
bots:
  - name: site-favicon-ico
    path_regex: ^/favicon\.ico$
    action: ALLOW
  - name: site-favicon-assets
    path_regex: ^/(?:favicon(?:-\d+x\d+(?:-[0-9a-f]{8})?)?\.(?:png|svg)|apple-touch-icon(?:-\d+x\d+(?:-[0-9a-f]{8})?)?\.png|images/site/(?:favicon|apple-touch-icon)[^/]*\.(?:png|svg))$
    action: ALLOW
  - import: (data)/meta/default-config.yaml
```

NixOS：

```nix
environment.etc."anubis/blog-policy.yaml".text = ''
  bots:
    - name: site-favicon-ico
      path_regex: ^/favicon\.ico$
      action: ALLOW
    - name: site-favicon-assets
      path_regex: ^/(?:favicon(?:-\d+x\d+(?:-[0-9a-f]{8})?)?\.(?:png|svg)|apple-touch-icon(?:-\d+x\d+(?:-[0-9a-f]{8})?)?\.png|images/site/(?:favicon|apple-touch-icon)[^/]*\.(?:png|svg))$
      action: ALLOW
    - import: (data)/meta/default-config.yaml
'';

services.anubis.instances.blog.settings.POLICY_FNAME = "/etc/anubis/blog-policy.yaml";
```

`policy.extraBots` 会追加在默认规则之后，浏览器请求会先命中 `generic-browser`，通常来不及。没有使用 `settings.POLICY_FNAME` 时，可设 `policy.useDefaultBotRules = false`，把 ALLOW 规则和 `{ import = "(data)/meta/default-config.yaml"; }` 按顺序放进 `extraBots`。自定义文件替换原 policy 时，保留原有的 `thresholds`、`store`、`status_codes` 等块。

`/favicon.ico` 是页面没有 icon 链接时浏览器隐式请求的路径，Anubis 默认通常已放行。可以额外放一个 `public/favicon.ico` 作为旧浏览器或挑战页兜底，但它不能替代 ALLOW：真实页面有显式 PNG 链接时，浏览器优先请求该链接。

改完配置后重新部署，并用无痕窗口验证；已有的 favicon 缓存可能需要清理一次。

## 排查

1. DevTools → Network，过滤 `favicon` 与 `apple-touch`。
2. 检查响应类型：图片，还是 `text/html` 挑战页。
3. 挑战页说明代理层未放行该路径；404 说明 `site.json` 路径或 `public/` 文件有误。
4. 图片正常但标签页仍旧时，清理浏览器 favicon 缓存或使用无痕窗口；Chrome 对根 URL 的 favicon 缓存较顽固。
5. 用 `curl` 确认线上文件：

```bash
curl -sS -o /dev/null -D - https://example.com/images/site/favicon-256x256-a1b2c3d4.png
```
