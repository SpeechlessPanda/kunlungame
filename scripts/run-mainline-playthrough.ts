import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runMainlineTurn } from '../src/modeling/mainlineTurnRunner.js'
import { buildRecentTurnMemory } from '../src/renderer/composables/recentTurnMemory.js'
import { buildLogStamp, ensureLogDir } from './logPaths.js'
import {
    ATTITUDE_MAX,
    ATTITUDE_MIN,
    applyPlayerChoice,
    createDefaultRuntimeState,
    type RuntimeState
} from '../src/runtime/runtimeState.js'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'
import { loadOpenAiCompatibleEnv } from './openAiCompatibleEnv.js'
import { parsePlaythroughOptions, pickPlaythroughChoice } from './playthroughOptions.js'

/**
 * 用真实本地模型一次性走完一段主线，把每一轮的 prompt 输入与模型输出落盘到日志，
 * 便于人工审计「AI 是否真的读了 prompt / 知识条目 / 当前态度倾向」。
 *
 * 用法：
 *   pnpm playthrough                            # 默认 align 全程，第一节点
 *   pnpm playthrough -- --pattern=alt           # align/challenge 交替
 *   pnpm playthrough -- --pattern=challenge     # 全程怀疑
 *   pnpm playthrough -- --choices=align,challenge,challenge,align # 自定义用户选择序列
 *   pnpm playthrough -- --maxNodes=3            # 只跑前 3 个节点
 *   pnpm playthrough -- --turnsPerNode=2        # 每节点跑 2 轮（默认按 minTurns + 1）
 *   pnpm playthrough -- --pattern=alt           # 若 .env.local 含 API Key，会走 OpenAI-compatible
 *   KUNLUN_SMOKE_MODE=compatibility pnpm playthrough  # 强制 1.5B Lite 兜底档
 *   KUNLUN_SMOKE_MODE=pro pnpm playthrough            # 强制 7B Pro 档（需手动下 Q3_K_M 权重）
 */

const main = async (): Promise<void> => {
    const opts = parsePlaythroughOptions()
    const projectRoot = process.cwd()
    const appDataDir = process.env['APPDATA']
        ? join(process.env['APPDATA'], 'Kunlungame')
        : join(projectRoot, 'runtime-cache')

    const forcedMode = process.env['KUNLUN_SMOKE_MODE']
    const preferredMode: 'default' | 'compatibility' | 'pro' =
        forcedMode === 'compatibility' ? 'compatibility'
            : forcedMode === 'pro' ? 'pro'
                : 'default'

    const openAiCompatible = await loadOpenAiCompatibleEnv(projectRoot)
    let state: RuntimeState = createDefaultRuntimeState(mainlineStoryOutline)
    if (openAiCompatible != null) {
        state = {
            ...state,
            settings: {
                ...state.settings,
                modelProvider: 'openai-compatible',
                openAiCompatible
            }
        }
    }
    const recentTurns: string[] = []
    const log: string[] = []

    const stamp = buildLogStamp()
    const logDir = await ensureLogDir(projectRoot, 'playthroughs')
    const runLabel = opts.choiceSequence.length > 0 ? 'custom' : opts.pattern
    const logFile = join(logDir, `playthrough-${preferredMode}-${runLabel}-${stamp}.md`)

    log.push(`# Playthrough · ${preferredMode} · ${runLabel} · ${stamp}`)
    log.push('')
    log.push(`- maxNodes: ${opts.maxNodes}`)
    log.push(`- turnsPerNode: ${opts.turnsPerNode ?? 'minTurns'}`)
    log.push(`- choices: ${opts.choiceSequence.join(', ') || `(pattern:${opts.pattern})`}`)
    log.push(`- provider: ${openAiCompatible == null ? 'local' : 'openai-compatible'}`)
    if (openAiCompatible != null) {
        log.push(`- baseUrl: ${openAiCompatible.baseUrl}`)
        log.push(`- model: ${openAiCompatible.model}`)
        log.push(`- fallbackModels: ${openAiCompatible.fallbackModels.join(', ') || '(none)'}`)
    }
    log.push('')

    let totalTurns = 0
    let nodesPlayed = 0

    while (nodesPlayed < opts.maxNodes && !state.isCompleted) {
        const node = mainlineStoryOutline.nodes.find((n) => n.id === state.currentNodeId)
        if (node == null) break
        const targetTurnsForNode = opts.turnsPerNode ?? node.minTurns

        for (let i = 0; i < targetTurnsForNode; i += 1) {
            const choice = pickPlaythroughChoice(opts, totalTurns)
            const t0 = Date.now()
            const result = await runMainlineTurn({
                preferredMode,
                availableGpuVramGb: null,
                isPackaged: false,
                projectRoot,
                appDataDir,
                nodeId: state.currentNodeId,
                attitudeChoiceMode: choice,
                runtimeState: state,
                recentTurns: recentTurns.slice(-5)
            })
            const elapsed = Date.now() - t0

            log.push(`---`)
            log.push(`## 节点 ${node.id} · 轮 ${i + 1} / ${targetTurnsForNode} （totalTurn=${totalTurns + 1}）`)
            log.push('')
            log.push(`- attitudeChoice: \`${choice}\``)
            log.push(`- attitudeScore (before turn): \`${state.attitudeScore}\``)
            log.push(`- turnsInCurrentNode (before): \`${state.turnsInCurrentNode}\``)
            log.push(`- turnIndex (before): \`${state.turnIndex}\``)
            log.push(`- elapsedMs: \`${elapsed}\``)
            log.push('')

            if (result.ok === false) {
                log.push(`**FAILED**: \`${result.reason}\` — ${result.message}`)
                console.error(`[playthrough] turn failed:`, result.reason, result.message)
                await writeFile(logFile, log.join('\n'), 'utf8')
                process.exitCode = 1
                return
            }

            log.push(`- selectedProfile: \`${result.selectedProfileId}\``)
            log.push(`- chunks: \`${result.chunks.length}\``)
            log.push(`- text length (chars): \`${result.combinedText.length}\``)
            log.push(`- options: ${result.options.map((o) => `[${o.semantic}] ${o.label}`).join(' | ')}`)
            log.push('')
            log.push('### combinedText')
            log.push('')
            log.push('```')
            log.push(result.combinedText)
            log.push('```')
            log.push('')

            console.log(`[turn ${totalTurns + 1}] node=${node.id} choice=${choice} chars=${result.combinedText.length} elapsed=${elapsed}ms`)

            const selectedOption = result.options.find((option) => option.semantic === choice)
            recentTurns.push(buildRecentTurnMemory({
                modelReply: result.combinedText,
                choice: {
                    id: choice,
                    label: selectedOption?.label ?? choice
                }
            }))
            state = applyPlayerChoice({ state, storyOutline: mainlineStoryOutline, choice })
            totalTurns += 1

            // 写盘一次，方便长跑中途也能看进度
            await writeFile(logFile, log.join('\n'), 'utf8')
        }

        nodesPlayed += 1
    }

    log.push('---')
    log.push(`## 总结`)
    log.push('')
    log.push(`- 共跑 ${totalTurns} 轮，跨 ${nodesPlayed} 个节点。`)
    log.push(`- 最终 attitudeScore: ${state.attitudeScore} (range ${ATTITUDE_MIN}~${ATTITUDE_MAX})`)
    log.push(`- 最终 currentNodeId: ${state.currentNodeId}`)
    log.push(`- isCompleted: ${state.isCompleted}`)

    await writeFile(logFile, log.join('\n'), 'utf8')
    console.log(`\n[playthrough] log written to: ${logFile}`)
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
})
