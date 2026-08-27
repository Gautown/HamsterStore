// AwesomeSublistParser — awesome 子列表解析器
// 解析具体的 awesome 子列表（如 awesome-nodejs）

import { ListParser } from "../ListParser";
import type { ParsedEntry } from "../ListParser";

export class AwesomeSublistParser {
    private listParser: ListParser;
    constructor() { this.listParser = new ListParser(); }

    // 解析 awesome 子列表 README
    parse(readme: string): ParsedEntry[] {
        return this.listParser.parseAwesomeSublist(readme);
    }
}