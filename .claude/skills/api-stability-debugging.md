# API 稳定性调试模式

当 OpenAI-compatible API 调用失败时的诊断和修复流程。

## 故障特征
- `orchestration-failed terminated`：SSE 流被服务器断开
- `timed out after 120s`：请求超时
- `Malformed OpenAI-compatible stream payload`：SSE 数据格式错误

## 诊断步骤
1. 运行 `pnpm smoke:openai` 测试单轮请求是否正常
2. 检查 `.env.local` 中 API key 和 base URL 是否正确
3. 查看 `logs/dialogue-smoke/` 目录下的日志文件
4. 如果单轮正常但多轮失败，通常是 API 限流或模型上下文过长

## 重试机制
- `dialogueOrchestrator.ts` 中 `MAX_RETRIES = 2`，最多尝试 3 次
- 仅对 `terminated`/`timed out`/`ECONNRESET`/`socket` 错误重试
- 每次重试间隔递增：2s → 4s → 6s
- 重试前会发送 `reset` 事件清空已显示的文本

## 调整参数
- `DEFAULT_FETCH_TIMEOUT_MS`：fetch 超时，默认 120s
- `max_tokens`：输出 token 上限，默认 400
- `temperature`：创造性参数，默认 0.72
- `MAX_REPLY_LENGTH`：字符截断上限，默认 340

## 常见修复
- API key 过期：更新 `.env.local`
- 模型不支持 stream：检查 provider 文档
- 输出被截断：增大 `max_tokens` 或减少 prompt 长度
- 频繁超时：增大 `DEFAULT_FETCH_TIMEOUT_MS`
