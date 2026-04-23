# Windows 模型下载排障

适用场景：

1. `pnpm models:download` 在 Windows 上提前退出。
2. 模型文件大小在变化，但脚本仍报错或没有写出 manifest。
3. 终端里出现 `BITS`、`Invoke-WebRequest`、重复 `tsx scripts/download-models.ts` 或多个 `curl.exe`。

处理步骤：

1. 先只保留一条下载链，杀掉命令行包含 `scripts/download-models.ts`、`download-models`、测试下载文件名的 `node.exe`、`cmd.exe`、`curl.exe`。
2. 删除 `runtime-cache/models/.download.lock` 和临时下载文件，例如 `test.part`、`BIT*.tmp`。
3. 用 `curl.exe -I -L` 查询远端 `Content-Length`，核对本地文件是否已完整。
4. 若只剩单个文件未完成，优先直接执行单进程 `curl.exe --continue-at -` 续传到目标路径。
5. 文件全部完整后，再运行 `pnpm exec tsx scripts/download-models.ts`，只让脚本补写 `manifest.json` 并做最终校验。

已验证结论：

1. Windows 下应统一使用 `curl.exe` 顺序下载。
2. 不要回退到 `BITS` 或 `Invoke-WebRequest`，它们会引入孤儿进程和重复写入风险。
3. 当前完整文件尺寸为：7B part1 `3993201344`，7B part2 `689872288`，3B `2104932768`。