# pnpm audit 在 npmmirror 下失败

## 失败信号

- `pnpm audit --prod` 返回 `ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS`
- 报错里 URL 形如 `https://registry.npmmirror.com/-/npm/v1/security/audits`

## 原因

本仓库默认 registry 指向 `registry.npmmirror.com`（加速下载），但 npmmirror 没有实现 npm audit 端点，所以审计请求直接 404。

## 修复

显式指向官方 registry 跑 audit：

```powershell
pnpm audit --prod --registry=https://registry.npmjs.org/
```

## 何时触发

每次做 release audit（`.github/copilot-instructions.md` §6 的 2.1 步骤）都要用这条命令。
不要改全局 `.npmrc` 的 registry，否则安装会退回到慢速源。

## 相关条目

- `docs/audits/2026-04-24-release-audit.md` §2.1
