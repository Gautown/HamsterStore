# Crash 可复现工作流 (Crash Reproducibility)

> 背景: 2026-08-10 的 `HamsterStore-GUI.exe` 崩溃为
> `EXCEPTION_STACK_OVERFLOW (0xC00000FD)`,故障点位于 `user32.dll` 消息派发阶段。
> 当时的 mini-dump **没有栈内存**,且从未生成 `.pdb`(`*.pdb` 被 gitignore),
> 崩溃的 `.exe` 随后被 08-17 构建覆盖 —— 导致该崩溃**无法从产物中复现或调试**。

为避免重蹈覆辙,本项目从 2026-08-28 起强制以下构建约束。

## 构建约束 (已写入 package.json)

```bash
npm run build:cli   # perry compile src/main.ts -o dist/HamsterStore.exe --emit-attest
npm run build:gui   # perry compile src/gui/main.ts -o dist/HamsterStore-GUI.exe \
                    #   --target windows --min-windows-version 10 \
                    #   --debug-symbols --emit-attest
```

两个构建都带:

- `--debug-symbols`:Windows 下向 lld-link 传入 `/DEBUG`,**必然生成 `HamsterStore-GUI.pdb`**。
  这是 08-10 缺失、导致崩溃不可调试的关键产物。
- `--emit-attest`:在 `.exe` 旁生成 `<name>.exe.attest.json`,固含
  `sha256` + `perry_version` + `built_at_unix`,用于把崩溃 dump 精确对应回源码。

## 每次发布/调试时的产物

`dist/` 现在应同时包含:

```
HamsterStore.exe
HamsterStore.attest.json
HamsterStore-GUI.exe
HamsterStore-GUI.pdb        <- 崩溃调试必需
HamsterStore-GUI.exe.attest.json
```

`.pdb` 与 `.exe` 通过内部 GUID+age 配对;attest 的 `sha256` 必须与出问题的 `.exe`
字节一致,否则符号对不上。

## 收到崩溃 dump 后的排查步骤

1. 从 `*.exe.attest.json` 读出 `sha256` + `perry_version` + `built_at_unix`。
2. 在本地按同版本 perry 重新 `npm run build:gui`(同一份 `src`),会生成
   同 GUID 的 `HamsterStore-GUI.pdb`(前提是 `src` 与该构建时一致)。
3. 用 WinDbg / `cdb` 打开 dump + 同目录 `.pdb`,即可把
   `perry-runtime` 与用户函数栈符号化到 `file:line`。
4. 若 `commit_sha` 为空(构建目录本身不是 git 仓库时 perry 不填),
   需人工对照 `built_at_unix` 与提交历史确定源码版本。

## 已知待解事项

- 08-10 崩溃根因仍未确认:源码审计未发现无限递归
  (`buildMainBody` / `rebuildBody` / `navigateToDetail` 均在按钮点击回调内,
  不在 widget 构造期)。主导怀疑是 `perry/ui` 运行时对深层嵌套
  HStack/VStack 树的布局递归。需带符号的 `.pdb` 构建方可验证。
- `commit_sha` 当前为空:因构建副本 `PerryTS/HamsterStore` 不是 git 仓库。
  建议将其设为真正的 git 工作树,或在 CI 中于 git 仓库内构建,
  以便 attest 自动写入 commit。
