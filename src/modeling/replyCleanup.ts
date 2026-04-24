/**
 * 对本地模型输出做最后一层轻量清洗——在 prompt 层已尽力禁止的情况下，
 * 3B / 7B 仍会偶发地把角色标签、分隔符或上一轮的整段追问原样带出。
 * 这层清洗是"保底"网：
 *   - 剥离 `昆仑：` / `角色：` / `[Kunlun]` 这类行首角色标注；
 *   - 剥离 `---` / `===` / markdown 标题 / `[[PREV_REPLY...]]` 等内部标签；
 *   - 基于 recentTurns 做整句去重，如果新回复里出现长度≥10 的句子与任一历史轮完全相同，
 *     则在本轮文本里删掉那一句。
 * 不做重写、不做改写，只做删除——保证语义损失最小，同时让复读彻底消失在界面里。
 */

const ROLE_LABEL_PATTERN = /^[\s*·•>\-]*(?:昆仑|kunlun|Kunlun|KUNLUN|角色|主持人|旁白)\s*[:：]\s*/u

const STRUCTURAL_NOISE_PATTERNS: RegExp[] = [
    /^\s*-{3,}\s*$/,
    /^\s*={3,}\s*$/,
    /^\s*#{1,6}\s+.*$/,
    /^\s*\*[^*]+\*\s*$/,
    /^\s*\[\[\/?PREV_REPLY_\d+\]\]\s*$/
]

const INLINE_NOISE_PATTERNS: RegExp[] = [
    /\[\[\/?PREV_REPLY_\d+\]\]/g,
    /\b(?:System|Assistant|User)\s*:\s*/g
]

const splitSentences = (text: string): string[] => {
    // 以句末符号切句，保留分隔符让调用者可以拼回。
    const pieces: string[] = []
    const re = /([^。！？?!.\n]+[。！？?!.\n]?)/g
    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
        if (match[1] != null && match[1].length > 0) pieces.push(match[1])
    }
    return pieces
}

const collectPriorSentences = (recentTurns: string[], minLen: number): Set<string> => {
    const bank = new Set<string>()
    for (const turn of recentTurns) {
        for (const sentence of splitSentences(turn)) {
            const trimmed = sentence.trim()
            // 去掉末尾句号等分隔符再比较，避免"一样的一句话"因为句号差异漏掉。
            const normalized = trimmed.replace(/[。！？?!.\s]+$/u, '')
            if (normalized.length >= minLen) bank.add(normalized)
        }
    }
    return bank
}

export interface SanitizeOptions {
    recentTurns?: string[]
    /** 判为"原句复读"的最小字数阈值；默认 10。低于此长度的句子允许重复（如"嘻嘻"）。*/
    minDuplicateLen?: number
}

/**
 * 对单轮输出做保底清洗。返回清洗后的文本；如果整行全是噪声或复读，会被删除，
 * 其他段落原样保留。
 */
export const sanitizeMainlineReply = (raw: string, options: SanitizeOptions = {}): string => {
    const recentTurns = options.recentTurns ?? []
    const minDuplicateLen = options.minDuplicateLen ?? 10
    const priorSentences = collectPriorSentences(recentTurns, minDuplicateLen)

    // 第一步：逐行剥离角色标签与结构性噪声。
    const lines = raw.split(/\r?\n/)
    const cleanedLines: string[] = []
    for (const line of lines) {
        if (STRUCTURAL_NOISE_PATTERNS.some((p) => p.test(line))) continue
        let next = line
        // 可能多次出现：`昆仑：诶呀...昆仑：你说` 之类。
        let guard = 0
        while (ROLE_LABEL_PATTERN.test(next) && guard < 4) {
            next = next.replace(ROLE_LABEL_PATTERN, '')
            guard += 1
        }
        for (const pattern of INLINE_NOISE_PATTERNS) {
            next = next.replace(pattern, '')
        }
        cleanedLines.push(next)
    }

    // 第二步：按句去重。把整段按换行 + 句末符号拆成句子，逐句判断是否与历史完全重合。
    const rebuilt: string[] = []
    for (const line of cleanedLines) {
        if (line.trim().length === 0) {
            rebuilt.push('')
            continue
        }
        const sentences = splitSentences(line)
        if (sentences.length === 0) {
            rebuilt.push(line)
            continue
        }
        const keptSentences: string[] = []
        for (const sentence of sentences) {
            const normalized = sentence.trim().replace(/[。！？?!.\s]+$/u, '')
            if (normalized.length >= minDuplicateLen && priorSentences.has(normalized)) {
                // 命中历史原句，整句丢弃。
                continue
            }
            keptSentences.push(sentence)
        }
        const rebuiltLine = keptSentences.join('').trimEnd()
        rebuilt.push(rebuiltLine)
    }

    // 第三步：折叠连续空行，去掉前后空白。
    const collapsed: string[] = []
    let prevBlank = false
    for (const line of rebuilt) {
        const isBlank = line.trim().length === 0
        if (isBlank && prevBlank) continue
        collapsed.push(line)
        prevBlank = isBlank
    }
    return collapsed.join('\n').trim()
}
