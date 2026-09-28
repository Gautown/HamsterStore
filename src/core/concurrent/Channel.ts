// 消息通道（进度事件 / 结果汇总的发布-订阅）
// 对应开发文档 §7.1 src/core/concurrent/Channel.ts
//        §8.9.4「工作线程通过通道向主线程发送进度事件 { sourceId, processed, total }」
//
// 实现说明：Perry 的 parallelMap 是同步返回的，工作线程无法 postMessage 回主线程；
//          因此通道落地为「批次完成即发布」的进度汇聚点——执行器在每批任务
//          结束后通过通道 publish 一次进度事件，订阅方（UI 进度条 / CLI 输出）
//          立即收到，等价于文档中"非阻塞进度报告"的目标。

export type ChannelListener<T> = (event: T) => void;

export class Channel<T> {
    private listeners: ChannelListener<T>[] = [];
    private history: T[] = [];
    private historyLimit: number;
    private publishedCount: number = 0;

    constructor(historyLimit: number = 0) {
        this.historyLimit = historyLimit > 0 ? historyLimit : 0;
    }

    /** 订阅事件，返回取消订阅函数 */
    subscribe(fn: ChannelListener<T>): () => void {
        this.listeners.push(fn);
        const listeners = this.listeners;
        return () => {
            const i = listeners.indexOf(fn);
            if (i >= 0) listeners.splice(i, 1);
        };
    }

    /** 发布事件；单个订阅者抛错不影响其他订阅者 */
    publish(event: T): void {
        this.publishedCount++;
        if (this.historyLimit > 0) {
            this.history.push(event);
            if (this.history.length > this.historyLimit) this.history.shift();
        }
        for (let i = 0; i < this.listeners.length; i++) {
            try {
                this.listeners[i](event);
            } catch (e: any) {
                // 订阅者异常不得打断发布链路
            }
        }
    }

    /** 最近事件（仅当构造时指定 historyLimit > 0） */
    getEvents(): T[] {
        return this.history.slice();
    }

    /** 最近一次事件 */
    getLast(): T | undefined {
        return this.history.length > 0 ? this.history[this.history.length - 1] : undefined;
    }

    clearHistory(): void {
        this.history = [];
    }

    /** 取消所有订阅 */
    unsubscribeAll(): void {
        this.listeners = [];
    }

    get listenerCount(): number {
        return this.listeners.length;
    }

    get totalPublished(): number {
        return this.publishedCount;
    }
}