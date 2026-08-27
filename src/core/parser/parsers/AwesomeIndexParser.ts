// AwesomeIndexParser — sindresorhus/awesome 主索引解析器
// 解析 README 中的分类章节，提取每个子列表链接

import { ListParser } from "../ListParser";
import type { ParsedSublist } from "../ListParser";

export class AwesomeIndexParser {
    private listParser: ListParser;
    constructor() { this.listParser = new ListParser(); }

    // 解析 sindresorhus/awesome 主索引 → 子列表数组
    parseIndex(readme: string): ParsedSublist[] {
        return this.listParser.parseAwesomeIndex(readme);
    }
}