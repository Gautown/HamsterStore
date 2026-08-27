// OssdateParser — ossdate/open-source-software-for-enterprises 专用解析器
// 企业级分类表格

import { ListParser } from "../ListParser";
import type { ParsedEntry } from "../ListParser";

export class OssdateParser {
    private listParser: ListParser;
    constructor() { this.listParser = new ListParser(); }
    parse(readme: string): ParsedEntry[] {
        return this.listParser.parseOssdate(readme);
    }
}