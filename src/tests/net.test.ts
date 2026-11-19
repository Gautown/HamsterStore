// netFetch 回归测试 — 真实网络（需外网，npm run test:net 单独运行）
// 验证完整性契约（2026-11-19 加固）：
//   1. curl -f：HTTP 404 必须回调 ok=false（此前错误页被当成功 body）
//   2. netDownload：成功时字节数 == HEAD Content-Length，落盘大小一致
//   3. netDownload 404 必须失败（触发 DownloadManager 直连回退的前提）
// 下载目标用 release 二进制资产（产品真实路径，镜像返回 Content-Length）；
// raw 文本经 Cloudflare 镜像是 chunked 无长度，只测 GET 内容不测长度。
// 走 gh-proxy.org 镜像（国内直连 GitHub 不稳定）。
import { netGetText, netContentSize, netDownload } from "../core/net/netFetch";
import { join } from "node:path";
import { existsSync, unlinkSync, statSync } from "node:fs";

let passed = 0;
let failed = 0;
function check(name: string, actual: any, expected: any): void {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) { passed++; console.log("  ✓ " + name); }
    else { failed++; console.log("  ✗ " + name + " — 期望 " + JSON.stringify(expected) + "，实际 " + JSON.stringify(actual)); }
}

const M = "https://gh-proxy.org/";
const TEXT = M + "https://raw.githubusercontent.com/BurntSushi/ripgrep/master/README.md";
const ASSET = M + "https://github.com/BurntSushi/ripgrep/releases/download/14.1.1/ripgrep-14.1.1-x86_64-pc-windows-msvc.zip";
const BAD = M + "https://raw.githubusercontent.com/BurntSushi/ripgrep/master/NO_SUCH_FILE_404.md";
const tmp = process.env.TEMP || process.env.TMP || ".";
const dest = join(tmp, "hs_net_test_" + Date.now() + ".zip");
const destBad = join(tmp, "hs_net_test_bad_" + Date.now() + ".zip");

console.log("netFetch 网络回归测试（真实 curl + 镜像加速）\n");

// 全局超时保护：网络挂死时判失败而非无限等待
const kill = setTimeout(() => {
    console.log("\n全局超时 (120s) — 网络测试失败");
    process.exit(1);
}, 120000);

let expectedTotal = -1;
netContentSize(ASSET, 20000, (total: number) => {
    expectedTotal = total;
    check("release 资产 HEAD Content-Length > 0", total > 0, true);

    netGetText(TEXT, { timeoutMs: 20000 }, (ok: boolean, body: string) => {
        check("GET 文本 ok", ok, true);
        check("GET body 非空", body.length > 0, true);
        check("GET 内容正确", body.indexOf("ripgrep") >= 0, true);

        netGetText(BAD, { timeoutMs: 20000 }, (ok2: boolean, _body2: string) => {
            check("GET 404 被拒（-f 契约）", ok2, false);

            netDownload(ASSET, dest, { timeoutMs: 120000 },
                () => { /* 进度回调不校验 */ },
                (ok3: boolean, bytes: number) => {
                    check("下载 ok", ok3, true);
                    check("下载字节 > 0", bytes > 0, true);
                    if (expectedTotal > 0) {
                        check("下载字节 == Content-Length", bytes, expectedTotal);
                    }
                    check("落盘大小一致", existsSync(dest) ? statSync(dest).size : -1, bytes);

                    // 404 下载：短超时（空文件要等到 deadline 才判失败）
                    netDownload(BAD, destBad, { timeoutMs: 5000 },
                        () => {},
                        (ok4: boolean, _bytes4: number) => {
                            check("下载 404 被拒", ok4, false);

                            try { if (existsSync(dest)) unlinkSync(dest); } catch {}
                            try { if (existsSync(destBad)) unlinkSync(destBad); } catch {}
                            clearTimeout(kill);
                            console.log("\n==============================================");
                            console.log("通过 " + passed + " / 失败 " + failed);
                            if (failed > 0) { console.log("测试失败"); process.exit(1); }
                            console.log("全部测试通过");
                            process.exit(0);
                        });
                });
        });
    });
});
