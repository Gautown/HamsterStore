// HolyShellParser — holyshell/AppsForWindows 专用解析器
// 链接列表格式

import { ListParser } from "../ListParser";
import type { ParsedEntry } from "../ListParser";

export class HolyShellParser {
    private listParser: ListParser;
    constructor() { this.listParser = new ListParser(); }
    parse(readme: string): ParsedEntry[] {
        return this.listParser.parseHolyShell(readme);
    }
}