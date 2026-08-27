// RateLimiter — 速率限制器
// 控制爬虫请求频率，避免被 GitHub 封禁

export class RateLimiter {
    private minInterval: number;  // 最小请求间隔（ms）
    private lastRequest: number = 0;
    private pendingCount: number = 0;

    constructor(minIntervalMs: number = 2000) {
        this.minInterval = minIntervalMs;
    }

    // 在发请求前等待合适时间
    async waitForNextSlot(): Promise<void> {
        const now = Date.now();
        const elapsed = now - this.lastRequest;
        if (elapsed < this.minInterval) {
            const wait = this.minInterval - elapsed;
            this.sleepSync(wait);
        }
        this.lastRequest = Date.now();
        this.pendingCount++;
    }

    // 同步版本（用于 curl execSync 之前等待）
    waitSync(): void {
        const now = Date.now();
        const elapsed = now - this.lastRequest;
        if (elapsed < this.minInterval) {
            const wait = this.minInterval - elapsed;
            this.sleepSync(wait);
        }
        this.lastRequest = Date.now();
        this.pendingCount++;
    }

    // 设置最小间隔
    setInterval(minIntervalMs: number): void {
        this.minInterval = minIntervalMs;
    }

    // 获取统计信息
    getStats(): { pendingCount: number; lastRequest: number; minInterval: number } {
        return {
            pendingCount: this.pendingCount,
            lastRequest: this.lastRequest,
            minInterval: this.minInterval,
        };
    }

    private sleepSync(ms: number): void {
        // 在没有 perry/thread 的环境下阻塞等待
        const start = Date.now();
        while (Date.now() - start < ms) {
            // 自旋，避免无限循环
        }
    }
}