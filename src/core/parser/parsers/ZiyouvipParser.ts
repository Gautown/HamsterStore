// ZiyouvipParser — ziyouvip/awesome-windows-software 专用解析器
// 简单列表格式

import { ListParser } from "../ListParser";
import type { ParsedEntry } from "../ListParser";

export class ZiyouvipParser {
    private listParser: ListParser;
    constructor() { this.listParser = new ListParser(); }
    parse(readme: string): ParsedEntry[] {
        return this.listParser.parseZiyouvip(readme);
    }
}