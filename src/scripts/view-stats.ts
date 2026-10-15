// 浏览数据（PV / UV）接入点：只负责取数并填值，槽位与样式由主题渲染。
// 槽位 [data-view-stats] 带 data-view-scope / data-view-path / data-view-route / data-view-title，
// 子节点为 [data-view-stat="pv"|"uv"] 及其 [data-view-stat-value]，未填值时带 hidden。
// scope 取值 article / archive / projects / bits / devlog / blog / about / home；
// path 为含部署 base 的浏览器路径，route 为去掉 base 的逻辑路由，title 为纯文本标题。
// 开关在 Theme Console → 内页设置 →「浏览数据」；打开但未填值时页面不显示内容。
// 取数与接入方式见 docs/analytics.md。

export {};
