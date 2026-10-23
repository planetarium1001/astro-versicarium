/* jsdom 未安装 @types/jsdom（devDependency 只引入运行时）；测试只需要最小声明。 */
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string, options?: Record<string, unknown>);
    window: {
      document: Document;
      close(): void;
    };
  }
  export class VirtualConsole {
    on(event: string, listener: (...args: unknown[]) => void): void;
  }
}
