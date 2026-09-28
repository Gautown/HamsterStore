// 原子计数器 + 窗口限流器（速率控制）
// 对应开发文档 §7.1 src/core/concurrent/AtomicCounter.ts
//        §8.9.4「原子计数器：用于跨线程的速率限制（如爬虫请求计数）」
//
// 实现说明：Perry 0.5.1520 的并行原语是函数级（parallelMap / spawn），
//          线程间无法共享可变状态（闭包禁止捕获可变变量，编译期强制）。
//          而本项目的全部网络 I/O 都发生在同一异步主线程（netFetch 回调链），
//          因此限流以「共享预算窗口」形式实现——预算在统一调用点扣减，
//          效果等同于文档所述原子计数器，且不存在跨线程竞态。

export class AtomicCounter {
    private value: number = 0;

    increment(n: number = 1): number {
        this.value += n;
        return this.value;
    }

    decrement(n: number = 1): number {
        this.value -= n;
        return this.value;
    }

    get(): number {
        return this.value;
    }

    reset(v: number = 0): void {
        this.value = v;
    }

    set(v: number): void {
        this.value = v;
    }
}

export interface RateLimiterOptions {
    /** 每个窗口允许的最大请求数 */
    maxPerWindow: number;
    /** 窗口长度（毫秒），默认 60000（GitHub 未授权 60 次/小时） */
    windowMs?: number;
}

export class RateLimiter {
    private maxPerWindow: number;
    private windowMs: number;
    private windowStart: number;
    private counter: AtomicCounter;
    private rejectedCount: number = 0;

    constructor(options: RateLimiterOptions) {
        this.maxPerWindow = options.maxPerWindow > 0 ? options.maxPerWindow : 60;
        this.windowMs = options.windowMs && options.windowMs > 0 ? options.windowMs : 60000;
        this.windowStart = Date.now();
        this.counter = new AtomicCounter();
    }

    /** 尝试占用一个配额。成功 true；超限 false（调用方应降级或等待） */
    tryAcquire(): boolean {
        this.rollWindow();
        if (this.counter.get() >= this.maxPerWindow) {
            this.rejectedCount++;
            return false;
        }
        this.counter.increment();
        return true;
    }

    /** 强制占用一个配额（不检查上限），用于已确认必须发出的请求 */
    acquire(): void {
        this.rollWindow();
        this.counter.increment();
    }

    /** 距离当前窗口结束还剩多少毫秒；0 表示窗口已过期可立即重试 */
    waitMs(): number {
        const elapsed = Date.now() - this.windowStart;
        return elapsed >= this.windowMs ? 0 : this.windowMs - elapsed;
    }

    /** 是否需要等待才能再取配额 */
    isExhausted(): boolean {
        this.rollWindow();
        return this.counter.get() >= this.maxPerWindow;
    }

    private rollWindow(): void {
        if (Date.now() - this.windowStart >= this.windowMs) {
            this.windowStart = Date.now();
            this.counter.reset(0);
        }
    }

    /** 本窗口已用配额 */
    get used(): number {
        this.rollWindow();
        return this.counter.get();
    }

    get limit(): number {
        return this.maxPerWindow;
    }

    get windowSizeMs(): number {
        return this.windowMs;
    }

    /** 被限流拒绝的次数（用于日志/诊断） */
    get rejected(): number {
        return this.rejectedCount;
    }

    /** 剩余配额 */
    remaining(): number {
        this.rollWindow();
        const r = this.maxPerWindow - this.counter.get();
        return r > 0 ? r : 0;
    }
}