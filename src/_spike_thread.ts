// _spike_thread.ts — Perry 0.5.1520 并发原语探针
// 目的：验证 parallelMap / parallelFilter / spawn 在本项目工具链下能否编译 + 运行
// 通过后即删除（不进主流程）

import { parallelMap, parallelFilter, spawn } from "perry/thread";

function burn(n: number): number {
    // CPU 密集：制造可测量的工作量
    let s = 0;
    for (let i = 0; i < n * 200000; i++) s += Math.sqrt(i);
    return Math.round(s);
}

async function run(): Promise<void> {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];

    // 1. parallelMap
    const t1 = Date.now();
    const doubled = parallelMap(arr, (n: number) => n * 2);
    console.log("[1] parallelMap:", JSON.stringify(doubled), "in", Date.now() - t1, "ms");

    // 2. parallelFilter
    const t2 = Date.now();
    const evens = parallelFilter(arr, (n: number) => n % 2 === 0);
    console.log("[2] parallelFilter:", JSON.stringify(evens), "in", Date.now() - t2, "ms");

    // 3. spawn -> Promise
    const t3 = Date.now();
    const v = await spawn(() => burn(3));
    console.log("[3] spawn resolved:", v, "in", Date.now() - t3, "ms");

    // 4. 并发加速比：串行 vs 并行
    const t4 = Date.now();
    const serial = arr.map((n: number) => burn(n));
    const serialMs = Date.now() - t4;
    const t5 = Date.now();
    const parallel = parallelMap(arr, (n: number) => burn(n));
    const parallelMs = Date.now() - t5;
    console.log("[4] serial:", serialMs, "ms | parallel:", parallelMs, "ms | speedup:",
        (serialMs / Math.max(parallelMs, 1)).toFixed(2) + "x");
    console.log("[4] checksum equal:", JSON.stringify(serial) === JSON.stringify(parallel));

    console.log("SPIKE_DONE");
}

run();