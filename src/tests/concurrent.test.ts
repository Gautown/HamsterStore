// 并发基础设施测试套件
// 运行：npm run test:concurrent
//
// 覆盖 src/core/concurrent/ 四个组件 + Perry 跨线程语义约束。
// 设计原则：断言式（失败即 exit 1），可脚本化验收；不依赖任何网络/数据库。

import {
    ThreadPool, TaskQueue, RateLimiter, AtomicCounter, Channel, splitIntoChunks, resolvePoolSize,
} from "../core/concurrent";
import type { ParallelProgress } from "../core/concurrent";

let passed = 0;
let failed = 0;

function check(label: string, actual: any, expected: any): void {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) {
        passed++;
        console.log("  \u2713 " + label);
    } else {
        failed++;
        console.log("  \u2717 " + label + " — 期望 " + JSON.stringify(expected) + "，实际 " + JSON.stringify(actual));
    }
}

function checkTrue(label: string, cond: boolean): void {
    check(label, cond, true);
}

// ── 模拟 CPU 密集型打分（与去重引擎 §4.5.2 同构） ──
class Scorer {
    tokenize(name: string): string[] {
        const lower = (name || "").toLowerCase();
        let n = "";
        for (let i = 0; i < lower.length; i++) {
            const c = lower.charAt(i);
            if (c === "-" || c === "_" || c === " ") n += " ";
            else if ((c >= "a" && c <= "z") || (c >= "0" && c <= "9")) n += c;
        }
        return n.split(" ").filter(w => w.length > 0);
    }

    similarity(a: string, b: string): number {
        const ta = this.tokenize(a);
        const tb = this.tokenize(b);
        let inter = 0;
        for (const t of ta) if (tb.indexOf(t) >= 0) inter++;
        const union = ta.length + tb.length - inter;
        return union > 0 ? inter / union : 0;
    }

    // 类方法内引用 this 的闭包 → 必须可并行（Perry 允许捕获 const/实例）
    scoreAll(names: string[], cands: string[], pool: ThreadPool): number[] {
        return pool.mapParallel<string, number>(
            names,
            (name: string) => {
                let best = 0;
                for (let j = 0; j < cands.length; j++) {
                    const s = this.similarity(name, cands[j]);
                    if (s > best) best = s;
                }
                return Math.round(best * 1000) / 1000;
            },
            "test-score"
        );
    }
}

// ── 1. TaskQueue ──
function testTaskQueue(): void {
    console.log("\n[TaskQueue]");
    const q = new TaskQueue<number>({ maxSize: 3 });
    check("push 1", q.push(1), true);
    check("push 2", q.push(2), true);
    check("push 3", q.push(3), true);
    check("push 4 触发背压", q.push(4), false);
    check("size", q.size, 3);
    check("dropped", q.dropped, 1);
    check("isFull", q.isFull(), true);
    check("peek 不移除", q.peek(), 1);
    check("size 未变", q.size, 3);
    check("shift", q.shift(), 1);
    check("shift 后 size", q.size, 2);
    check("drain", q.drain(), [2, 3]);
    check("drain 后空", q.isEmpty(), true);
    check("空队列 shift", q.shift(), null);
    check("totalPushed", q.totalPushed, 3);

    // 惰性压缩正确性：大量入出队后顺序不乱
    const big = new TaskQueue<number>({ maxSize: 1000 });
    for (let i = 0; i < 500; i++) big.push(i);
    let seq = true;
    for (let i = 0; i < 500; i++) if (big.shift() !== i) seq = false;
    checkTrue("500 次入出队顺序正确（惰性压缩无损）", seq);
}

// ── 2. AtomicCounter / RateLimiter ─
function testRateLimiter(): void {
    console.log("\n[AtomicCounter / RateLimiter]");
    const ac = new AtomicCounter();
    check("初始值", ac.get(), 0);
    ac.increment();
    ac.increment(4);
    check("increment", ac.get(), 5);
    ac.decrement(2);
    check("decrement", ac.get(), 3);
    ac.set(10);
    check("set", ac.get(), 10);
    ac.reset();
    check("reset", ac.get(), 0);

    const rl = new RateLimiter({ maxPerWindow: 3, windowMs: 60000 });
    check("第1次取配额", rl.tryAcquire(), true);
    check("第2次取配额", rl.tryAcquire(), true);
    check("第3次取配额", rl.tryAcquire(), true);
    check("第4次被拒", rl.tryAcquire(), false);
    check("used", rl.used, 3);
    check("limit", rl.limit, 3);
    check("remaining", rl.remaining(), 0);
    check("rejected", rl.rejected, 1);
    check("isExhausted", rl.isExhausted(), true);
    checkTrue("waitMs > 0", rl.waitMs() > 0);

    // 窗口过期后自动重置（用 1ms 窗口验证 rollWindow）
    const fast = new RateLimiter({ maxPerWindow: 1, windowMs: 1 });
    fast.tryAcquire();
    check("1ms 窗口内已耗尽", fast.isExhausted(), true);
    const spinStart = Date.now();
    while (Date.now() - spinStart < 5) { /* 等窗口过期 */ }
    check("窗口过期后恢复", fast.tryAcquire(), true);
}

// ── 3. Channel ──
function testChannel(): void {
    console.log("\n[Channel]");
    const ch = new Channel<string>(2);
    let count = 0;
    const seen: string[] = [];
    const off = ch.subscribe((e: string) => { count++; seen.push(e); });
    ch.publish("a");
    ch.publish("b");
    check("订阅者收到 2 次", count, 2);
    check("顺序正确", seen, ["a", "b"]);

    off();
    ch.publish("c");
    check("取消订阅后不再收到", count, 2);
    check("listenerCount", ch.listenerCount, 0);

    // historyLimit=2 → 只保留最近 2 条
    check("历史受 limit 限制", ch.getEvents(), ["b", "c"]);
    check("getLast", ch.getLast(), "c");
    check("totalPublished", ch.totalPublished, 3);

    // 订阅者抛错不得打断其他订阅者
    const ch2 = new Channel<string>();
    let good = 0;
    ch2.subscribe(() => { throw new Error("boom"); });
    ch2.subscribe(() => { good++; });
    ch2.publish("x");
    check("异常订阅者被隔离", good, 1);
}

// ── 4. ThreadPool 并行正确性（核心） ──
function testThreadPool(): void {
    console.log("\n[ThreadPool]");
    const pool = new ThreadPool({ maxWorkers: 4, minParallelBatch: 1 });
    check("size", pool.size, 4);

    const names: string[] = [];
    const cands: string[] = [];
    for (let i = 0; i < 200; i++) names.push("app-" + i + "-toolkit");
    for (let j = 0; j < 150; j++) cands.push("cand-" + j + "-toolkit-app");

    const scorer = new Scorer();

    // 串行基线
    const serial: number[] = [];
    for (let i = 0; i < names.length; i++) {
        let best = 0;
        for (let j = 0; j < cands.length; j++) {
            const s = scorer.similarity(names[i], cands[j]);
            if (s > best) best = s;
        }
        serial.push(Math.round(best * 1000) / 1000);
    }

    // 并行（类方法内引用 this）
    let progressEvents = 0;
    let lastPhase = "";
    pool.onProgress((p: ParallelProgress) => { progressEvents++; lastPhase = p.phase; });
    const parallel = scorer.scoreAll(names, cands, pool);

    check("并行结果长度一致", parallel.length, serial.length);
    // 顺序+数值逐项一致（最关键的断言：并行不得打乱顺序或算错）
    check("并行结果与串行逐项一致（顺序+数值）", parallel, serial);
    checkTrue("进度事件已发布", progressEvents > 0);
    check("进度事件 phase", lastPhase, "test-score");

    const stats = pool.getStats();
    checkTrue("统计记录了并行调用", stats.parallelCalls > 0);
    check("并行度", stats.maxWorkers, 4);

    // mapParallel 空数组
    check("空数组返回空", pool.mapParallel<number, number>([], (n: number) => n * 2), []);

    // 小批量走串行（低于阈值）
    const small = new ThreadPool({ maxWorkers: 4, minParallelBatch: 50 });
    const r = small.mapParallel<number, number>([1, 2, 3], (n: number) => n * 10);
    check("小批量结果正确", r, [10, 20, 30]);
    check("小批量走串行路径", small.getStats().serialCalls, 1);

    // reduceParallel
    const arr: number[] = [];
    for (let i = 1; i <= 200; i++) arr.push(i);
    const sum = pool.reduceParallel<number, number>(
        arr, () => 0, (acc: number, n: number) => acc + n, (a: number, b: number) => a + b, "test-reduce"
    );
    check("reduceParallel 大数组求和", sum, 20100);  // 200*201/2

    const emptySum = pool.reduceParallel<number, number>(
        [], () => 0, (acc: number, n: number) => acc + n, (a: number, b: number) => a + b
    );
    check("reduceParallel 空数组", emptySum, 0);

    pool.shutdown();
}

// ── 5. 工具函数 ──
function testUtils(): void {
    console.log("\n[工具函数]");
    check("splitIntoChunks 整除", splitIntoChunks<number>([1, 2, 3, 4, 5, 6], 3), [[1, 2], [3, 4], [5, 6]]);
    check("splitIntoChunks 有余数", splitIntoChunks<number>([1, 2, 3, 4, 5, 6, 7], 3), [[1, 2, 3], [4, 5, 6], [7]]);
    check("splitIntoChunks 空数组", splitIntoChunks<number>([], 3), []);
    check("splitIntoChunks count<=0", splitIntoChunks<number>([1, 2], 0), []);
    check("resolvePoolSize 显式值优先", resolvePoolSize(4), 4);
    checkTrue("resolvePoolSize(0) 返回默认并行度", resolvePoolSize(0) >= 1);
}

function main(): void {
    console.log("并发基础设施测试套件");

    testTaskQueue();
    testRateLimiter();
    testChannel();
    testThreadPool();
    testUtils();

    console.log("\n" + "=".repeat(46));
    console.log("通过 " + passed + " / 失败 " + failed);
    if (failed > 0) {
        console.log("测试失败");
        process.exit(1);
    }
    console.log("全部测试通过");
}

main();