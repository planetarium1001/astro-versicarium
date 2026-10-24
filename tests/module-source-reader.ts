import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * 按目录读取全部 .ts 并拼接成一份源码。
 *
 * 后台几个大模块已拆成同名目录加薄 barrel，原本针对单文件源码的字符串断言
 * （换行归一化、标签分隔符、兼容性字段顺序等）需要看到拆分后的全部实现，
 * 用这个函数按目录拼接即可等价于拆分前的单文件。
 */
export const readModuleDir = async (base: string, relativeDir: string): Promise<string> => {
  const dir = path.join(base, relativeDir);
  const names = (await readdir(dir)).filter((name) => name.endsWith('.ts')).sort();
  const contents = await Promise.all(names.map((name) => readFile(path.join(dir, name), 'utf8')));
  return contents.join('\n');
};
