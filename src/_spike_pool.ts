// _spike_pool.ts — 并发基础设施验收探针（验证后删除）
// 覆盖：TaskQueue 背压 / RateLimiter 限流 / Channel 订阅 / ThreadPool 真并行 + 顺序一致
// 重点验证 Perry 编译期约束：闭包捕获 const、类方法内引用 this

import {
    ThreadPool, TaskQueue, RateLimiter, AtomicCounter, Channel, splitIntoChunks, resolvePoolSize,
} from "./core/concurrent";
import type { ParallelProgress } from "./core/concurrent";

// ── 模拟「去重打分」：CPU 密集型，与文档 §4.5.2 模糊匹配同构 ──
class Scorer {
    readonly threshold: number = 0.75;

    // ⚠ Perry 坑：正则字面量（/[-_]/g）在 .replace() 中会导致链接期缺
    //    js_regexp_new / js_string_replace_regex 符号 → 改为字符遍历
    tokenize(name: string): string[] {
        const lower = name.toLowerCase();
        let normalized = "";
        for (let i = 0; i < lower.length; i++) {
            const c = lower.charAt(i);
            if (c === "-" || c === "_" || c === " ") normalized += " ";
            else if ((c >= "a" && c <= "z") || (c >= "0" && c <= "9")) normalized += c;
        }
        return normalized.split(" ").filter(w => w.length > 0);
    }

    score(a: string, b: string): number {
        const ta = this.tokenize(a);
        const tb = this.tokenize(b);
        let inter = 0;
        for (const t of ta) if (tb.indexOf(t) >= 0) inter++;
        const union = ta.length + tb.length - inter;
        if (union === 0) return 0;
        let s = inter / union;
        if (a.startsWith(b) || b.startsWith(a)) s += 0.4;
        return s;
    }

    // 单条目 vs 全部候选：CPU 密集主循环
    bestMatch(name: string, candidates: string[]): number {
        let best = 0;
        for (let i = 0; i < candidates.length; i++) {
            const s = this.score(name, candidates[i]);
            if (s > best) best = s;
        }
        return Math.round(best * 1000) / 1000;
    }

    // 批量打分（调用点：类方法内引用 this → 验证闭包捕获类实例能否编译）
    scoreAll(names: string[], candidates: string[], pool: ThreadPool): number[] {
        return pool.mapParallel<string, number>(
            names,
            (name: string, _i: number) => this.bestMatch(name, candidates),
            "dedup"
        );
    }
}

function buildData(): { names: string[]; candidates: string[] } {
    const names: string[] = [];
    const candidates: string[] = [];
    for (let i = 0; i < 300; i++) names.push("app-" + i + "-toolkit");
    for (let j = 0; j < 200; j++) candidates.push("cand-" + j + "-toolkit-app");
    return { names, candidates };
}

function main(): void {
    // ─ [1] TaskQueue 背压 ──
    const q = new TaskQueue<number>({ maxSize: 5 });
    let accepted = 0;
    for (let i = 0; i < 8; i++) if (q.push(i)) accepted++;
    console.log("[1] TaskQueue: accepted=" + accepted + " rejected=" + q.dropped + " size=" + q.size +
        " isEmpty=" + q.isEmpty() + " full=" + q.isFull());
    const drained = q.drain();
    console.log("[1] drain=" + JSON.stringify(drained) + " sizeAfter=" + q.size + " peek=" + q.peek());

    // ── [2] AtomicCounter + RateLimiter ─
    const ac = new AtomicCounter();
    ac.increment(); ac.increment(4); ac.decrement(2);
    console.log("[2] AtomicCounter: " + ac.get() + " (期望 3)");
    const rl = new RateLimiter({ maxPerWindow: 3, windowMs: 60000 });
    const grants: boolean[] = [];
    for (let i = 0; i < 5; i++) grants.push(rl.tryAcquire());
    console.log("[2] RateLimiter: " + JSON.stringify(grants) + " used=" + rl.used + "/" + rl.limit +
        " remaining=" + rl.remaining() + " rejected=" + rl.rejected + " exhausted=" + rl.isExhausted());

    // ─ [3] Channel 订阅 ──
    const ch = new Channel<string>(3);
    let received = 0;
    const off = ch.subscribe((e: string) => { received++; });
    ch.publish("a"); ch.publish("b"); ch.publish("c"); ch.publish("d");
    off();
    ch.publish("e");
    console.log("[3] Channel: received=" + received + " (期望 4) listeners=" + ch.listenerCount +
        " history=" + JSON.stringify(ch.getEvents()) + " last=" + ch.getLast() +
        " total=" + ch.totalPublished);

    // ── [4] ThreadPool 真并行 + 顺序一致 + 类方法捕获 ──
    const data = buildData();
    const scorer = new Scorer();
    const pool = new ThreadPool({ maxWorkers: 8, minParallelBatch: 1 });

    let progressHits = 0;
    let lastProgress: ParallelProgress | null = null;
    pool.onProgress((p: ParallelProgress) => { progressHits++; lastProgress = p; });

    // 串行基线
    const t0 = Date.now();
    const serial: number[] = [];
    for (let i = 0; i < data.names.length; i++) serial.push(scorer.bestMatch(data.names[i], data.candidates));
    const serialMs = Date.now() - t0;

    // 并行（类方法内引用 this）
    const t1 = Date.now();
    const parallel = scorer.scoreAll(data.names, data.candidates, pool);
    const parallelMs = Date.now() - t1;

    let same = serial.length === parallel.length;
    if (same) for (let i = 0; i < serial.length; i++) if (serial[i] !== parallel[i]) { same = false; break; }

    console.log("[4] serial=" + serialMs + "ms parallel=" + parallelMs + "ms speedup=" +
        (serialMs / Math.max(parallelMs, 1)).toFixed(2) + "x  n=" + data.names.length);
    console.log("[4] order+value identical: " + same);
    console.log("[4] progress events: " + progressHits + " last=" +
        (lastProgress ? JSON.stringify(lastProgress) : "null"));
    console.log("[4] pool stats: " + JSON.stringify(pool.getStats()));

    // ── [5] reduceParallel / splitIntoChunks / resolvePoolSize ──
    // 注：刻意不测 forEachParallel —— Perry 跨线程深拷贝传值，回调副作用不回传，
    //     该 API 已从 ThreadPool 移除（见 ThreadPool.ts 中的说明）。
    const total = pool.reduceParallel<number, number>(
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        () => 0,
        (acc: number, n: number) => acc + n,
        (a: number, b: number) => a + b,
        "spike"
    );
    console.log("[5] reduceParallel=" + total + " (期望 55)");

    const chunks = splitIntoChunks<number>([1, 2, 3, 4, 5, 6, 7], 3);
    console.log("[5] splitIntoChunks(7,3)=" + JSON.stringify(chunks));
    console.log("[5] resolvePoolSize(0)=" + resolvePoolSize(0) + " resolvePoolSize(4)=" + resolvePoolSize(4));

    pool.shutdown();
    console.log("SPIKE_POOL_DONE");
}

main();