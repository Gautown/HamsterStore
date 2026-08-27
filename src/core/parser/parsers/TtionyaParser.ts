// TtionyaParser — ttionya/Personal-Software 专用解析器
// 表格格式（master 分支）

import { ListParser } from "../ListParser";
import type { ParsedEntry } from "../ListParser";

export class TtionyaParser {
    private listParser: ListParser;
    constructor() { this.listParser = new ListParser(); }
    parse(readme: string): ParsedEntry[] {
        return this.listParser.parseTtionya(readme);
    }
}