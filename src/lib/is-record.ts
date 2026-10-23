/**
 * 「是普通对象」判定的唯一实现。
 *
 * 全仓曾散落二十余份逐字相同的副本，任一处语义漂移都会让「客户端提交 →
 * 服务端规范化」对同一份载荷得出不同结果，因此统一到这里。
 *
 * 这里只做对象判定，不 import 任何 node 内置模块：浏览器端脚本与构建期代码共用。
 */

/** 宽松对象类型：键未知、值未知，调用方自行按需收窄。 */
export type LooseRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is LooseRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
