// StackiaParser — stackia/best-windows-apps 专用解析器
// 表格 + 引用链接格式

import { ListParser } from "../ListParser";
import type { ParsedEntry } from "../ListParser";

export class StackiaParser {
    private listParser: ListParser;
    constructor() { this.listParser = new ListParser(); }
    parse(readme: string): ParsedEntry[] {
        return this.listParser.parseStackia(readme);
    }
}