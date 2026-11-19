// 任务队列（生产者-消费者 + 背压控制）
// 对应开发文档 §7.1 src/core/concurrent/TaskQueue.ts
//        §8.9.3「背压控制：当队列过长时，限制新任务提交，防止内存溢出」
//
// 实现说明：用「头指针 + 惰性压缩」避免 Array.shift() 的 O(n) 搬移，
//          队列在 1000+ 条目规模下仍保持 O(1) 出队。

export interface TaskQueueOptions {
    /** 队列最大长度；超过后 push 返回 false（背压生效）。默认 1000 */
    maxSize?: number;
}

export class TaskQueue<T> {
    private items: T[] = [];
    private head: number = 0;
    private maxSize: number;
    private droppedCount: number = 0;
    private pushedCount: number = 0;

    constructor(options: TaskQueueOptions = {}) {
        this.maxSize = options.maxSize && options.maxSize > 0 ? options.maxSize : 1000;
    }

    /** 入队。队列满时丢弃并返回 false（调用方据此施加背压） */
    push(item: T): boolean {
        if (this.size >= this.maxSize) {
            this.droppedCount++;
            return false;
        }
        this.items.push(item);
        this.pushedCount++;
        return true;
    }

    /** 入队；队列满时抛出错误（适合不允许静默丢弃的场景） */
    pushOrThrow(item: T): void {
        if (!this.push(item)) {
            throw new Error("TaskQueue 已满（上限 " + this.maxSize + "），拒绝新任务");
        }
    }

    /** 出队；空队列返回 null（与 Channel.getLast 的空值契约一致） */
    shift(): T | null {
        if (this.head >= this.items.length) return null;
        const value = this.items[this.head];
        this.head++;
        // 惰性压缩：已消费过半且超过阈值时回收前缀，避免内存持续增长
        if (this.head > 64 && this.head * 2 >= this.items.length) {
            this.items = this.items.slice(this.head);
            this.head = 0;
        }
        return value;
    }

    peek(): T | null {
        return this.head < this.items.length ? this.items[this.head] : null;
    }

    /** 一次性取出全部待处理项并清空 */
    drain(): T[] {
        const out = this.head === 0 ? this.items : this.items.slice(this.head);
        this.items = [];
        this.head = 0;
        return out;
    }

    clear(): void {
        this.items = [];
        this.head = 0;
    }

    get size(): number {
        return this.items.length - this.head;
    }

    get max(): number {
        return this.maxSize;
    }

    /** 因背压被丢弃的任务数 */
    get dropped(): number {
        return this.droppedCount;
    }

    /** 历史累计入队数（含已消费） */
    get totalPushed(): number {
        return this.pushedCount;
    }

    isFull(): boolean {
        return this.size >= this.maxSize;
    }

    isEmpty(): boolean {
        return this.size === 0;
    }
}