// ReleaseResolver 回归测试 — Windows 资产评分选择（纯函数，离线）
// 运行: npm run test:release（perry 编译为真实原生二进制执行）
// 重点回归：旧内联正则会选中 .zip.sha256 校验文件 / 兜底 assets[0] 选中 Linux 资产
import { pickWindowsAsset } from "../core/download/ReleaseResolver";
import type { Asset } from "../types";

let passed = 0;
let failed = 0;
function check(name: string, actual: any, expected: any): void {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) { passed++; console.log("  ✓ " + name); }
    else { failed++; console.log("  ✗ " + name + " — 期望 " + JSON.stringify(expected) + "，实际 " + JSON.stringify(actual)); }
}
function a(name: string): Asset {
    return { name, size: 1000, url: "", browser_download_url: "https://github.com/o/r/releases/download/v1/" + name };
}
function picked(assets: Asset[]): string | null {
    const r = pickWindowsAsset(assets);
    return r ? r.name : null;
}

console.log("ReleaseResolver 资产选择测试套件\n");

console.log("[扩展名优先级]");
check("msi 优先于 zip", picked([a("app-1.0.zip"), a("app-1.0.msi")]), "app-1.0.msi");
check("exe 优先于 zip", picked([a("app-1.0.zip"), a("app-1.0.exe")]), "app-1.0.exe");
check("zip 优先于 7z", picked([a("app-1.0.7z"), a("app-1.0.zip")]), "app-1.0.zip");
check("唯一 universal zip 可选", picked([a("EarTrumpet-2.3.0.0.zip")]), "EarTrumpet-2.3.0.0.zip");

console.log("\n[平台排除]");
check("仅 linux → null", picked([a("app-x86_64-linux.tar.gz")]), null);
check("linux+windows 混合选 windows", picked([a("app-x86_64-linux.tar.gz"), a("app-x86_64-windows.zip")]), "app-x86_64-windows.zip");
check("deb/rpm/dmg/apk 全排除", picked([a("app.deb"), a("app.rpm"), a("app.dmg"), a("app.apk")]), null);
check("darwin 排除（含 win 子串不误判）", picked([a("app-darwin-x64.zip"), a("app-windows-x64.zip")]), "app-windows-x64.zip");
check("大小写不敏感", picked([a("App-Windows-X64.zip")]), "App-Windows-X64.zip");
check("win64 关键词", picked([a("tool-win64.zip"), a("tool-linux.zip")]), "tool-win64.zip");

console.log("\n[校验和/源码排除 — 旧实现的真 bug]");
check("sha256 不被选中（旧正则 bug）", picked([a("ripgrep-14.1.1-x86_64-pc-windows-msvc.zip.sha256"), a("ripgrep-14.1.1-x86_64-pc-windows-msvc.zip")]), "ripgrep-14.1.1-x86_64-pc-windows-msvc.zip");
check("仅校验和 → null", picked([a("app.zip.sha256"), a("app.zip.asc")]), null);
check("Source code 归档排除", picked([a("Source code (zip)"), a("app-windows.zip")]), "app-windows.zip");
check("仅 Source code → null（旧兜底 assets[0] bug）", picked([a("Source code (zip)"), a("Source code (tar.gz)")]), null);

console.log("\n[架构偏好]");
check("x64 优先于 arm64", picked([a("app-windows-arm64.zip"), a("app-windows-x64.zip")]), "app-windows-x64.zip");
check("无架构信息仍可选", picked([a("app-windows.zip")]), "app-windows.zip");
check("portable 加分", picked([a("app-setup.zip"), a("app-portable.zip")]), "app-portable.zip");

console.log("\n[真实资产集]");
const ripgrep: Asset[] = [
    a("ripgrep-14.1.1-aarch64-apple-darwin.tar.gz"),
    a("ripgrep-14.1.1-aarch64-unknown-linux-gnu.tar.gz"),
    a("ripgrep-14.1.1-x86_64-apple-darwin.tar.gz"),
    a("ripgrep-14.1.1-x86_64-pc-windows-gnu.zip"),
    a("ripgrep-14.1.1-x86_64-pc-windows-msvc.zip"),
    a("ripgrep-14.1.1-x86_64-unknown-linux-musl.tar.gz"),
];
check("ripgrep 真实资产集：同分取先出现者（gnu 在 msvc 前）", picked(ripgrep), "ripgrep-14.1.1-x86_64-pc-windows-gnu.zip");
check("空数组 → null", picked([]), null);

console.log("\n==============================================");
console.log("通过 " + passed + " / 失败 " + failed);
if (failed > 0) { console.log("测试失败"); process.exit(1); }
console.log("全部测试通过");
process.exit(0);
