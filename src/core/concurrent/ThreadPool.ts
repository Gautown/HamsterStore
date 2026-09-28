// 有界并行执行器（线程池）
// 对应开发文档 §7.1 src/core/concurrent/ThreadPool.ts
//        §8.9.3「按模块并行策略」、§4.3.3「分片并行处理」
//
// ── 与文档设计的差异（重要）──────────────────────────────────────────
// 文档假设 perry/thread 提供 Worker + postMessage 的持久工作线程池。
// 0.5.1520 实测的真实原语只有三个（见 .perry/types/perry/thread/index.d.ts）：
//     parallelMap(array, fn)    → 按 CPU 核心并行映射，deep-copy 传值
//     parallelFilter(array, pred)
//     spawn(fn) → Promise<T>    单次后台线程
// 没有持久 Worker，也没有 postMessage。因此本执行器按 Perry 真实能力落地为
// 「有界分片并行执行器」：把批量任务均分成不超过 maxWorkers 片，每片一个线程
// 串行处理，从而获得 CPU 级真实并行，同时保证并发度可控（不会一次性铺开 N 个线程）。
// ───────────────────────────────────────────────────────────────────

import { parallelMap } from "perry/thread";
import { Channel } from "./Channel";

export interface ThreadPoolOptions {
    /** 最大并行度（通常 = CPU 核心数）。<=0 时回退为 4 */
    maxWorkers: number;
    /** 任务队列背压上限（透传给调用方的 TaskQueue 使用） */
    queueSize?: number;
    /** 低于该条目数不值得付线程调度开销，直接串行。默认 50 */
    minParallelBatch?: number;
}

export interface ParallelProgress {
    /** 已完成条目数 */
    done: number;
    /** 总条目数 */
    total: number;
    /** 当前批次下标 */
    chunkIndex: number;
    /** 总批次数 */
    chunkCount: number;
    /** 阶段标识（调用方自定义，如 "dedup" / "sync"） */
    phase: string;
}

export interface ThreadPoolStats {
    maxWorkers: number;
    parallelCalls: number;
    serialCalls: number;
    lastChunkCount: number;
    lastSpeedupHint: string;
}

export class ThreadPool {
    readonly maxWorkers: number;
    readonly minParallelBatch: number;
    readonly queueSize: number;

    private progressChannel: Channel<ParallelProgress>;
    private parallelCalls: number = 0;
    private serialCalls: number = 0;
    private lastChunkCount: number = 0;

    constructor(options: ThreadPoolOptions) {
        this.maxWorkers = options.maxWorkers && options.maxWorkers > 0 ? options.maxWorkers : 4;
        this.minParallelBatch =
            options.minParallelBatch && options.minParallelBatch > 0 ? options.minParallelBatch : 50;
        this.queueSize = options.queueSize && options.queueSize > 0 ? options.queueSize : 1000;
        this.progressChannel = new Channel<ParallelProgress>(20);
    }

    /** 并行度 */
    get size(): number {
        return this.maxWorkers;
    }

    /** 订阅进度事件（返回取消订阅函数） */
    onProgress(fn: (p: ParallelProgress) => void): () => void {
        return this.progressChannel.subscribe(fn);
    }

    /** 最近一次进度事件 */
    getLastProgress(): ParallelProgress | undefined {
        return this.progressChannel.getLast();
    }

    /**
     * 分片并行映射：保持输入顺序返回结果。
     * fn 必须是无副作用的纯计算（禁止捕获可变变量——Perry 编译期强制）。
     */
    mapParallel<T, R>(items: T[], fn: (item: T, index: number) => R, phase: string = ""): R[] {
        const total = items.length;
        if (total === 0) return [];

        // 小批量 / 单核 → 串行，避免线程调度开销反而变慢
        if (this.maxWorkers <= 1 || total < this.minParallelBatch) {
            this.serialCalls++;
            const out: R[] = [];
            for (let i = 0; i < total; i++) out.push(fn(items[i], i));
            this.progressChannel.publish({
                done: total, total: total, chunkIndex: 0, chunkCount: 1, phase: phase,
            });
            return out;
        }

        this.parallelCalls++;
        const chunkSize = Math.max(1, Math.ceil(total / this.maxWorkers));
        const chunks: T[][] = [];
        for (let i = 0; i < total; i += chunkSize) {
            chunks.push(items.slice(i, i + chunkSize));
        }
        const chunkCount = chunks.length;
        this.lastChunkCount = chunkCount;

        // chunkSize 为 const，闭包不捕获任何可变变量 → 满足 Perry 编译期约束
        const parts = parallelMap(chunks, (chunk: T[], ci: number) => {
            const base = ci * chunkSize;
            const part: R[] = [];
            for (let k = 0; k < chunk.length; k++) {
                part.push(fn(chunk[k], base + k));
            }
            return part;
        });

        const flat: R[] = [];
        for (let c = 0; c < parts.length; c++) {
            const part = parts[c];
            for (let k = 0; k < part.length; k++) flat.push(part[k]);
        }

        this.progressChannel.publish({
            done: total, total: total, chunkIndex: chunkCount - 1, chunkCount: chunkCount, phase: phase,
        });
        return flat;
    }

    /**
     *  已刻意不提供 forEachParallel。
     * Perry 的 parallelMap 跨线程是「深拷贝传值」：回调内对闭包变量的写入
     * 不会回传主线程（实测 sum 累加为 0）。因此并行阶段只允许纯计算并返回结果，
     * 副作用（DB 写入、UI 更新、计数累加）必须在主线程等并行结果返回后串行施加，
     * 这也正是文档 §4.3.3 步骤 5「数据库写操作通过串行队列集中提交」的要求。
     * 需要遍历请用 mapParallel 并消费返回值。
     */

    /** 并行归约：把大批量切成片，每片归约成一个中间值，再汇总 */
    reduceParallel<T, A>(
        items: T[],
        identity: () => A,
        step: (acc: A, item: T, index: number) => A,
        combine: (a: A, b: A) => A,
        phase: string = ""
    ): A {
        const total = items.length;
        if (total === 0) return identity();

        if (this.maxWorkers <= 1 || total < this.minParallelBatch) {
            this.serialCalls++;
            let acc = identity();
            for (let i = 0; i < total; i++) acc = step(acc, items[i], i);
            return acc;
        }

        this.parallelCalls++;
        const chunkSize = Math.max(1, Math.ceil(total / this.maxWorkers));
        const chunks: T[][] = [];
        for (let i = 0; i < total; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
        const chunkCount = chunks.length;
        this.lastChunkCount = chunkCount;

        const partials = parallelMap(chunks, (chunk: T[], ci: number) => {
            const base = ci * chunkSize;
            let acc = identity();
            for (let k = 0; k < chunk.length; k++) acc = step(acc, chunk[k], base + k);
            return acc;
        });

        let result = partials.length > 0 ? partials[0] : identity();
        for (let i = 1; i < partials.length; i++) result = combine(result, partials[i]);

        this.progressChannel.publish({
            done: total, total: total, chunkIndex: chunkCount - 1, chunkCount: chunkCount, phase: phase,
        });
        return result;
    }

    getStats(): ThreadPoolStats {
        return {
            maxWorkers: this.maxWorkers,
            parallelCalls: this.parallelCalls,
            serialCalls: this.serialCalls,
            lastChunkCount: this.lastChunkCount,
            lastSpeedupHint:
                this.parallelCalls > 0
                    ? this.parallelCalls + " 次并行 / " + this.serialCalls + " 次串行"
                    : "尚未执行并行任务",
        };
    }

    /**
     * 关闭执行器。
     * Perry 无持久工作线程（parallelMap 每次调用自建并回收线程），
     * 因此此处只需清空进度订阅与统计，不涉及线程回收。
     */
    shutdown(): void {
        this.progressChannel.unsubscribeAll();
        this.progressChannel.clearHistory();
    }
}

/** 把数组切成 count 片（尽量均匀；最后一片可能更短） */
export function splitIntoChunks<T>(items: T[], count: number): T[][] {
    const total = items.length;
    if (count <= 0 || total === 0) return [];
    const chunkSize = Math.max(1, Math.ceil(total / count));
    const chunks: T[][] = [];
    for (let i = 0; i < total; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
    return chunks;
}

/**
 * 根据设置解析并行度：0 表示自动 = CPU 核心数（文档 §5.1 thread_pool_size 默认 0）
 * Perry 无 os.cpus()，改用固定探测 + 环境变量覆盖。
 */
export function resolvePoolSize(configured: number): number {
    if (configured && configured > 0) return configured;
    const env = typeof process !== "undefined" && process.env ? process.env.HAMSTER_THREADS : "";
    const n = env ? parseInt(env, 10) : 0;
    if (n > 0) return n;
    return 8; // 保守默认值（文档 §12.7 加速比基准按 8 核测算）
}